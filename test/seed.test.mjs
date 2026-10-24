import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { createPayPal } from '../src/paypal.mjs';
import { seed } from '../scripts/seed.mjs';
import { assertLedger,callTool } from '../src/metering.mjs';
import { payOut,reconcile } from '../src/payments.mjs';
test('fresh startup seeds once with balanced history and the exact demo money path',async t=>{
  const db=openDb(':memory:');t.after(()=>db.close());const paypal=createPayPal({PAYPAL_MODE:'mock'},{db});
  await seed(db,paypal);assert.equal((await seed(db,paypal)).seeded,false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tools').get().n,6);assert.equal(db.prepare('SELECT COUNT(*) n FROM calls').get().n,180);
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='consumer_demo'").get().balance_micro,5_000_000);
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='provider_demo'").get().balance_micro,0);assertLedger(db);
  for(let i=0;i<3;i++)callTool(db,{accountId:'consumer_demo',toolName:'extract_entities',args:{text:'demo'},idempotencyKey:String(i)});
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='consumer_demo'").get().balance_micro,4_970_000);
  const payout=await payOut(db,paypal,'provider_demo');assert.equal(payout.amount_micro,30_000);assert.equal(payout.status,'SUCCESS');
  const report=await reconcile(db,paypal);assert.equal(report.rows.length,2);assert.equal(report.matched,2);assertLedger(db);
});
