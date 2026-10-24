import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './helpers.mjs';
import { createPayPal } from '../src/paypal.mjs';
import { createTopup,captureTopup,processWebhook,payOut,reconcile } from '../src/payments.mjs';
import { assertLedger,callTool } from '../src/metering.mjs';

test('captured top-ups and distinct webhook events credit an order only once',async t=>{
  const db=fixture(0);t.after(()=>db.close());let paypal=createPayPal({PAYPAL_MODE:'mock'},{db});
  const topup=await createTopup(db,paypal,'buyer',5_000_000,'fund');
  assert.equal((await createTopup(db,paypal,'buyer',5_000_000,'fund')).id,topup.id);
  await paypal.approveOrder(topup.order_id);await captureTopup(db,paypal,'buyer',topup.id);
  const row=db.prepare('SELECT * FROM topups').get();const event=paypal.synthesiseCaptureEvent(row.paypal_capture_id,row.paypal_order_id);
  assert.equal((await processWebhook(db,paypal,event,{verified:true})).duplicate,false);
  assert.equal((await processWebhook(db,paypal,event,{verified:true})).duplicate,true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM events WHERE kind='webhook.duplicate'").get().n,1);
  await processWebhook(db,paypal,{...event,id:'distinct-id'},{verified:true});
  await assert.rejects(()=>processWebhook(db,paypal,{...event,id:'forged'}));
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='buyer'").get().balance_micro,5_000_000);
  // A fresh driver must recover the same rail history after a process restart.
  paypal=createPayPal({PAYPAL_MODE:'mock'},{db});
  assert.equal((await paypal.captureOrder(topup.order_id)).purchase_units[0].payments.captures[0].id,row.paypal_capture_id);
  assert.equal((await reconcile(db,paypal)).matched,1);assertLedger(db);
});
test('payout settles earnings once and reconciles the outgoing rail transaction',async t=>{
  const db=fixture();t.after(()=>db.close());const paypal=createPayPal({PAYPAL_MODE:'mock'},{db});
  for(let i=0;i<3;i++)callTool(db,request(String(i)));
  const payout=await payOut(db,paypal,'author');assert.equal(payout.status,'SUCCESS');assert.equal(payout.amount_micro,30_000);
  assert.equal((await reconcile(db,paypal)).rows.find(r=>r.kind==='Payout').status,'MATCH');
  await assert.rejects(()=>payOut(db,paypal,'author'),/No whole-cent/);assertLedger(db);
});
test('ambiguous payout failure holds funds and retries the identical batch',async t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());
  const batches=[];let fail=true;const actual=createPayPal({PAYPAL_MODE:'mock'});
  const paypal={...actual,async createPayout(payload){batches.push(payload.senderBatchId);if(fail){fail=false;throw new Error('connection lost');}return actual.createPayout(payload);}};
  await assert.rejects(()=>payOut(db,paypal,'author'));
  assert.equal(db.prepare("SELECT reserved_micro FROM accounts WHERE id='author'").get().reserved_micro,10_000);assertLedger(db);
  assert.equal((await payOut(db,paypal,'author')).status,'SUCCESS');assert.equal(batches[0],batches[1]);assertLedger(db);
});
test('definite payout rejection releases reservation without deleting earnings',async t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());
  await assert.rejects(()=>payOut(db,{async createPayout(){const e=new Error('Rejected');e.status=422;e.body=JSON.stringify({name:'INSUFFICIENT_FUNDS'});throw e;}},'author'));
  assert.equal(db.prepare('SELECT status FROM payouts').get().status,'FAILED');assert.equal(JSON.parse(db.prepare('SELECT raw FROM payouts').get().raw).response.name,'INSUFFICIENT_FUNDS');assertLedger(db);
});
test('dry-run payout never consumes real ledger earnings',async t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());
  const payout=await payOut(db,{},'author',{dryRun:true});assert.equal(payout.status,'DRY_RUN');assertLedger(db);
});
test('production hosts and partial credentials fail closed',()=>{
  assert.throws(()=>createPayPal({PAYPAL_API_BASE:'https://api-m.paypal.com'}),/sandbox/);
  assert.throws(()=>createPayPal({PAYPAL_CLIENT_ID:'only-id'}),/Both/);
});

test('a known payout batch lookup failure keeps its reservation',async t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());
  const paypal={async createPayout(){return {batch_header:{payout_batch_id:'known-batch',batch_status:'PENDING'},items:[]};},async getPayout(){const error=new Error('Temporarily missing');error.status=404;error.body=JSON.stringify({name:'INVALID_REQUEST'});throw error;}};
  assert.equal((await payOut(db,paypal,'author')).status,'SENT');
  await assert.rejects(()=>payOut(db,paypal,'author'));
  assert.equal(db.prepare("SELECT reserved_micro FROM accounts WHERE id='author'").get().reserved_micro,10_000);
  assert.equal(db.prepare('SELECT status FROM payouts').get().status,'SENT');assertLedger(db);
});

async function completedRail(db) {
  const rail=createPayPal({PAYPAL_MODE:'mock'},{db});
  const topup=await createTopup(db,rail,'buyer',5_000_000,'real-read-shape');
  await rail.approveOrder(topup.order_id);await captureTopup(db,rail,'buyer',topup.id);
  for(let i=0;i<3;i++)callTool(db,request('fresh-'+i));
  await payOut(db,rail,'author');
  return rail;
}
const delayedReporting={transaction_details:[],last_refreshed_datetime:'2026-10-24T02:29:59Z'};
test('fresh API receipts verify both rails without pretending delayed reporting matched',async t=>{
  const db=fixture(0);t.after(()=>db.close());const rail=await completedRail(db);
  const before=db.prepare('SELECT * FROM accounts ORDER BY id').all();let orders=0,payouts=0;
  const live={...rail,mode:'live',async listTransactions(){return delayedReporting;},async getOrder(id){orders++;return rail.getOrder(id);},async getPayout(id){payouts++;return rail.getPayout(id);}};
  const report=await reconcile(db,live);
  assert.equal(report.matched,0);assert.equal(report.api_verified,2);assert.equal(orders,1);assert.equal(payouts,1);
  assert.equal(report.reporting_as_of,delayedReporting.last_refreshed_datetime);
  assert.ok(report.rows.every(r=>r.status==='PENDING_REPORT'&&r.api_status==='VERIFIED'));
  assert.deepEqual(db.prepare('SELECT * FROM accounts ORDER BY id').all(),before);assertLedger(db);
});
test('fresh receipt checks reject changed currencies, amounts and payout recipients',async t=>{
  const db=fixture(0);t.after(()=>db.close());const rail=await completedRail(db);
  const live={...rail,mode:'live',async listTransactions(){return delayedReporting;},async getOrder(id){const order=structuredClone(await rail.getOrder(id));order.purchase_units[0].payments.captures[0].seller_receivable_breakdown.paypal_fee.currency_code='JPY';return order;},async getPayout(id){const batch=structuredClone(await rail.getPayout(id));batch.items[0].payout_item.receiver='different@example.com';return batch;}};
  const report=await reconcile(db,live);assert.equal(report.api_verified,0);assert.ok(report.rows.every(r=>r.api_status==='MISMATCH'));assertLedger(db);
  live.getOrder=async id=>{const order=structuredClone(await rail.getOrder(id));order.purchase_units[0].payments.captures[0].amount.value='6.00';return order;};
  assert.equal((await reconcile(db,live)).rows.find(r=>r.kind==='Top-up').api_status,'MISMATCH');
});
test('stored successful receipts do not substitute for a failed fresh API read',async t=>{
  const db=fixture(0);t.after(()=>db.close());const rail=await completedRail(db);
  const unavailable=async()=>{throw new Error('API unavailable');};
  const report=await reconcile(db,{...rail,mode:'live',listTransactions:unavailable,getOrder:unavailable,getPayout:unavailable});
  assert.equal(report.api_verified,0);assert.equal(report.matched,0);assert.ok(report.rows.every(r=>r.api_status==='UNAVAILABLE'));assertLedger(db);
});

test('an omitted reporting payout fee requires a fresh item receipt and explicit source',async t=>{
  const db=fixture(0);t.after(()=>db.close());const rail=await completedRail(db);
  const live={...rail,mode:'live',async listTransactions(args){const report=structuredClone(await rail.listTransactions(args));for(const row of report.transaction_details)if(row.transaction_info.transaction_amount.value.startsWith('-'))delete row.transaction_info.fee_amount;return report;}};
  const report=await reconcile(db,live),payout=report.rows.find(r=>r.kind==='Payout');
  assert.equal(report.matched,2);assert.equal(payout.api_status,'VERIFIED');assert.equal(payout.reporting_fee_micro,null);assert.match(payout.fee_source,/PayPal Payouts GET/);
  live.getPayout=async()=>{throw new Error('Unavailable');};
  const missing=(await reconcile(db,live)).rows.find(r=>r.kind==='Payout');assert.equal(missing.status,'PENDING_FEE');assert.equal(missing.api_status,'UNAVAILABLE');assert.equal(missing.fee_source,null);
  live.getPayout=async id=>{const batch=structuredClone(await rail.getPayout(id));batch.items[0].payout_item_fee.value='0.01';return batch;};
  assert.equal((await reconcile(db,live)).rows.find(r=>r.kind==='Payout').status,'MISMATCH');assertLedger(db);
});
test('a present reporting fee in another currency cannot be replaced with a matching payout API fee',async t=>{
  const db=fixture(0);t.after(()=>db.close());const rail=await completedRail(db);
  const report=await reconcile(db,{...rail,mode:'live',async listTransactions(args){const report=structuredClone(await rail.listTransactions(args));for(const row of report.transaction_details)if(row.transaction_info.transaction_amount.value.startsWith('-'))row.transaction_info.fee_amount.currency_code='JPY';return report;}});
  assert.equal(report.rows.find(r=>r.kind==='Payout').status,'MISMATCH');
});
