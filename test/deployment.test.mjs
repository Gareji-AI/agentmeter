import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './helpers.mjs';
import { snapshot } from '../src/server.mjs';
import { ledgerIdentity } from '../scripts/verify-deployment.mjs';
import { callTool } from '../src/metering.mjs';
test('migration proof tolerates row order but detects changed balances and access keys',t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());const state=snapshot(db,{mode:'mock'}),original=ledgerIdentity(state);
  const reordered=structuredClone(state);reordered.tools.reverse();reordered.calls.reverse();assert.equal(ledgerIdentity(reordered).sha256,original.sha256);
  const changed=structuredClone(state);changed.buyer.balance_micro--;assert.notEqual(ledgerIdentity(changed).sha256,original.sha256);
  changed.buyer=structuredClone(state.buyer);changed.buyer.api_key='different-key';assert.notEqual(ledgerIdentity(changed).sha256,original.sha256);
  assert.ok(!JSON.stringify(original).includes(state.buyer.api_key));
});
test('migration proof detects changed call reservation keys and capture identities',t=>{
  const db=fixture();t.after(()=>db.close());callTool(db,request());const state=snapshot(db,{mode:'mock'}),original=ledgerIdentity(state);
  const changed=structuredClone(state);changed.calls[0].idempotency_key='different-retry-key';assert.notEqual(ledgerIdentity(changed).sha256,original.sha256);
  const capture=structuredClone(state);capture.topups[0].paypal_capture_id='different-capture';assert.notEqual(ledgerIdentity(capture).sha256,original.sha256);
});
