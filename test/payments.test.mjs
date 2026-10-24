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
  await assert.rejects(()=>payOut(db,{async createPayout(){const e=new Error('Rejected');e.status=422;throw e;}},'author'));
  assert.equal(db.prepare('SELECT status FROM payouts').get().status,'FAILED');assertLedger(db);
});
test('dry-run payout never consumes real ledger earnings',async t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());
  const payout=await payOut(db,{},'author',{dryRun:true});assert.equal(payout.status,'DRY_RUN');assertLedger(db);
});
test('production hosts and partial credentials fail closed',()=>{
  assert.throws(()=>createPayPal({PAYPAL_API_BASE:'https://api-m.paypal.com'}),/sandbox/);
  assert.throws(()=>createPayPal({PAYPAL_CLIENT_ID:'only-id'}),/Both/);
});
