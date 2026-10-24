import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { snapshot } from '../src/server.mjs';
import { renderPage } from '../src/views/index.mjs';
test('all SSR workspaces render English navigation and accessible controls',t=>{
  const db=fixture();t.after(()=>db.close());const data={...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',query:{}};
  for(const path of ['/','/app','/provider','/reconcile','/grid']) {
    const html=renderPage(path,data);assert.match(html,/<html lang="en">/);assert.match(html,/Skip to content/);assert.match(html,/MOCK · SIMULATED FUNDS/);
    for(const link of ['/app','/provider','/reconcile','/grid'])assert.ok(html.includes(`href="${link}"`));
  }
});
test('SSR escapes untrusted fields and script-embedded configuration',t=>{
  const db=fixture();t.after(()=>db.close());db.prepare("UPDATE tools SET name='<img src=x onerror=alert(1)>' WHERE id='extract-entities'").run();
  const html=renderPage('/app',{...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',studioLicense:'</script><script>alert(1)</script>',query:{}});
  assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('</script><script>alert(1)'));
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('\\u003c/script>'));
});
test('unauthenticated sandbox page never renders account keys',()=>{
  const html=renderPage('/app',{authenticated:false,mode:'sandbox',buyer:{api_key:'do-not-render'}});
  assert.ok(!html.includes('do-not-render'));assert.ok(html.includes('login-form'));
});

test('live receipt panels keep synthetic entries separate even on the same date',t=>{
  const db=fixture();t.after(()=>db.close());
  const data={...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',query:{}};
  const call={account_id:'buyer',owner_account_id:'author',id:'live_receipt_123456',tool_name:'live_tool',status:'SETTLED',price_micro:10_000,author_credit_micro:10_000,latency_ms:0,created_at:new Date().toISOString(),response_preview:'{}'};
  data.calls=[{...call,id:'seed_same_day',tool_name:'synthetic_only'},call];
  const html=renderPage('/app',data);
  const current=html.split('<div id="calls-table">')[1].split('<div class="receipt-detail">')[0];
  assert.match(current,/live_tool/);assert.doesNotMatch(current,/synthetic_only/);assert.match(html,/synthetic_only/);
  const payout={provider_account_id:'author',id:'live_payout',paypal_batch_id:'live-batch',status:'SUCCESS',amount_micro:10_000,payload:'{}',raw:'{}'};
  data.payouts=[{...payout,id:'seed_payout',paypal_batch_id:'synthetic-batch'},payout];
  const author=renderPage('/provider',data).split('<div id="payouts-table">')[1].split('Latest 15 live payouts')[0];
  assert.match(author,/live-batch/);assert.doesNotMatch(author,/synthetic-batch/);
});
test('reconciliation presents returned receipt states instead of a static all-clear',t=>{
  const db=fixture();t.after(()=>db.close());const data={...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',query:{}};
  const row={kind:'Top-up',reference:'rail-ref',gross_micro:5_000_000,fee_micro:660_000,net_micro:4_340_000,rail_micro:5_000_000};
  for(const [statuses,outcome,title] of [[[],'pending','Your receipt trail starts here.'],[['MATCH'],'matched','The reporting receipts agree.'],[['MATCH','MISMATCH'],'mismatch','Review the flagged receipts.'],[['RECEIPT_ONLY'],'pending','Waiting for independent reporting.']]){
    const html=renderPage('/reconcile',{...data,report:{rows:statuses.map(status=>({...row,status})),matched:999,source:'Test reporting'}});
    assert.ok(html.includes(`data-state="${outcome}"`));assert.ok(html.includes(title));assert.doesNotMatch(html,/Balanced|>999</);
  }
});

test('fresh receipt verification remains distinct from reporting and flags contradictory receipts',t=>{
  const db=fixture();t.after(()=>db.close());const data={...snapshot(db,{mode:'mock'}),authenticated:true,mode:'sandbox',query:{}};
  const row={kind:'Top-up',reference:'capture',gross_micro:5_000_000,fee_micro:480_000,net_micro:4_520_000,rail_micro:null,status:'PENDING_REPORT',api_status:'VERIFIED',api_amount_micro:5_000_000};
  const html=renderPage('/reconcile',{...data,report:{rows:[row],matched:0,source:'PayPal Transaction Search'}});
  assert.match(html,/data-state="receipts_verified"/);assert.match(html,/Fresh PayPal receipts agree/);assert.match(html,/PENDING_REPORT/);assert.match(html,/Transaction Search matches/);
  const mismatch=renderPage('/reconcile',{...data,report:{rows:[{...row,api_status:'MISMATCH'}],matched:0}});
  assert.match(mismatch,/data-state="mismatch"/);assert.doesNotMatch(mismatch,/Fresh PayPal receipts agree/);
});
