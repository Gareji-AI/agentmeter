import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture,request } from './helpers.mjs';
import { reserve,settle,callTool,assertLedger } from '../src/metering.mjs';
import { openDb } from '../src/db.mjs';
import { createPayPal } from '../src/paypal.mjs';
import { payOut,reconcile,creditCapture } from '../src/payments.mjs';

test('every browser script passes the runtime parser',()=>{
  for(const file of readdirSync(new URL('../src/public/',import.meta.url)).filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',new URL('../src/public/'+file,import.meta.url).pathname]);
});
test('reservations on independent SQLite connections share available funds',t=>{
  const dir=mkdtempSync(join(tmpdir(),'agentmeter-'));const path=join(dir,'ledger.sqlite');const first=fixture(10_000,openDb(path));const second=openDb(path);
  t.after(()=>{first.close();second.close();rmSync(dir,{recursive:true});});
  reserve(first,request('connection-1'));assert.throws(()=>reserve(second,request('connection-2')),e=>e.code===-32002);assertLedger(second);
});
test('settlement uses the reserved price, and disabled tools replay existing receipts',t=>{
  const db=fixture();t.after(()=>db.close());const r=reserve(db,request());db.prepare("UPDATE tools SET price_micro=990000,enabled=0 WHERE id='extract-entities'").run();
  settle(db,r.call.id,{receipt:true});settle(db,r.call.id,{receipt:false});
  const replay=callTool(db,request());assert.equal(replay.call.price_micro,10_000);assert.deepEqual(replay.result,{receipt:true});assertLedger(db);
});
test('idempotency keys belong to accounts, not to the entire installation',t=>{
  const db=fixture();t.after(()=>db.close());const at=new Date().toISOString();
  db.prepare("INSERT INTO accounts (id,kind,display_name,api_key,balance_micro,created_at) VALUES ('other','consumer','Other','other-key',10000,?)").run(at);
  db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,created_at) VALUES ('other-fund','other','OTHER',10000,'CAPTURED',?)").run(at);
  const first=callTool(db,request());const other=callTool(db,request('first',{accountId:'other'}));assert.notEqual(first.call.id,other.call.id);assertLedger(db);
});
test('forged capture amounts and currencies never credit a balance',t=>{
  const db=fixture(0);t.after(()=>db.close());const at=new Date().toISOString();db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,created_at) VALUES ('new','buyer','ORDER',10000,'CREATED',?)").run(at);
  for(const amount of [{currency_code:'EUR',value:'0.01'},{currency_code:'USD',value:'100.00'}])assert.throws(()=>creditCapture(db,'new',{id:'ORDER',status:'COMPLETED',purchase_units:[{payments:{captures:[{id:'CAP',status:'COMPLETED',amount}]}}]}),/match/);
  assertLedger(db);
});
test('reconciliation rejects an outgoing fee mismatch even when gross matches',async t=>{
  const db=fixture();t.after(()=>db.close());const paypal=createPayPal({PAYPAL_MODE:'mock'},{db});callTool(db,request());await payOut(db,paypal,'author');
  const original=paypal.listTransactions;paypal.listTransactions=async args=>{const report=await original(args);for(const row of report.transaction_details)row.transaction_info.fee_amount.value='0.99';return report;};
  const report=await reconcile(db,paypal);assert.equal(report.rows.find(r=>r.kind==='Payout').status,'MISMATCH');
});
