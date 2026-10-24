import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './helpers.mjs';
import { snapshot } from '../src/server.mjs';
import { ledgerIdentity,verifyDeployment } from '../scripts/verify-deployment.mjs';
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

test('hosted verification accepts additional providers but never labels pending reporting as a match',async t=>{
 const db=fixture();t.after(()=>db.close());let rows=[{id:'a',status:'MATCH'},{id:'b',status:'MATCH'},{id:'new-provider',status:'MATCH'}];
 t.mock.method(globalThis,'fetch',async(url,options)=>{const path=new URL(url).pathname;if(path==='/api/state'&&!options?.headers?.['X-Demo-Token'])return new Response('{}',{status:401});const body=path==='/health'?{mode:'sandbox',instance_id:'new-process'}:path==='/api/state'?snapshot(db,{mode:'sandbox'}):{rows,matched:rows.filter(r=>r.status==='MATCH').length};return Response.json(body);});
 const args={base:'https://backend.example',token:'operator'};assert.equal((await verifyDeployment(args)).report.rows.length,3);
 rows[2]={id:'new-provider',status:'PENDING_REPORT',api_status:'VERIFIED'};await assert.rejects(verifyDeployment(args),/Transaction Search/);
 const permitted=await verifyDeployment({...args,allowPendingReport:true});assert.equal(permitted.report.matched,2);assert.equal(permitted.report.rows[2].status,'PENDING_REPORT');
 rows[2].api_status='UNAVAILABLE';await assert.rejects(verifyDeployment({...args,allowPendingReport:true}),/Every rail/);
 rows[2]={id:'new-provider',status:'MATCH',api_status:'MISMATCH'};await assert.rejects(verifyDeployment({...args,allowPendingReport:true}),/Every rail/);
});
