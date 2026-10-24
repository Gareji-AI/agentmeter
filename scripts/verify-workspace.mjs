// Fresh isolated HTTP proof. No .env loading, real payments, model or Codex model turn.
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,writeFileSync,mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb } from '../src/db.mjs';
import { createApplication } from '../src/server.mjs';
import { seed } from './seed.mjs';
import { assertLedger } from '../src/metering.mjs';
import { payOut,reconcile } from '../src/payments.mjs';
const directory=mkdtempSync(join(tmpdir(),'agentmeter-user-proof-'));
const db=openDb(join(directory,'ledger.sqlite'));
const app=createApplication({db,env:{PAYPAL_MODE:'mock',PUBLIC_WORKSPACES:'1'}});
try{
  await seed(db,app.paypal);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.server.address().port}`;app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;
  let cookie='';
  const send=async(path,body,extra={})=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','Idempotency-Key':'public-flow-funding',...extra},body:body?JSON.stringify(body):undefined});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    const value=await response.json();assert.equal(response.status,body&&path.endsWith('/workspaces')||body&&path.endsWith('/keys')?201:200,JSON.stringify(value));return value;
  };
  await send('/api/customer/workspaces',{name:'Invoice intake proof'});
  const initial=await send('/api/customer/state');assert.equal(initial.account.balance_micro,0);
  const topup=await send('/api/customer/topups',{amount:'5.00'});await send('/api/customer/mock/approve',{topup_id:topup.id});
  const issued=await send('/api/customer/keys',{label:'MCP verification'});
  const run=async(name,args,requestId)=>send('/mcp',{jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name,arguments:{...args,_request_id:requestId}}},{Authorization:'Bearer '+issued.key,Accept:'application/json, text/event-stream','Idempotency-Key':''});
  const calls=[];
  calls.push(await run('extract_entities',{text:'Invoice DEMO-101. Total $120.00. Due 2026-11-12. Contact billing@example.com'},'invoice-101'));
  calls.push(await run('extract_entities',{text:'Invoice DEMO-102. Total $85.00. Due 2026-11-15. Contact accounts@example.org'},'invoice-102'));
  calls.push(await run('validate_links',{text:'https://example.com/invoice/101 https://example.org/invoice/102'},'invoice-links'));
  assert.ok(calls.every(x=>x.result));
  assert.equal((await run('extract_entities',{text:'Invoice DEMO-101. Total $120.00. Due 2026-11-12. Contact billing@example.com'},'invoice-101')).result._meta.agentmeter.reused,true);
  const state=await send('/api/customer/state');assert.equal(state.account.balance_micro,4_970_000);assert.equal(state.calls.length,3);
  assert.equal((await fetch(base+'/api/state',{headers:{Cookie:cookie}})).status,401);
  await send('/api/customer/budget',{amount:'0.00'});assert.equal((await run('extract_entities',{text:'blocked'},'blocked')).error.code,-32004);
  const payout=await payOut(db,app.paypal,'provider_demo');assert.equal(payout.amount_micro,30_000);assert.equal(payout.status,'SUCCESS');
  const report=await reconcile(db,app.paypal);assert.equal(report.matched,3);assertLedger(db);
  await send(`/api/customer/keys/${issued.id}/revoke`,{});
  assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+issued.key,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})})).status,401);
  const proof={at:new Date().toISOString(),mode:'mock',pass:true,starting_customer_micro:0,funded_micro:5_000_000,remaining_customer_micro:state.account.balance_micro,successful_calls:3,author_payout_micro:payout.amount_micro,mock_report_matches:report.matched,checks:['separate workspace','one-time client key','MCP invoice extraction and URL validation','receipt replay','monthly cap','operator denied','revocation']};
  mkdirSync('data/verification/workspaces',{recursive:true});writeFileSync('data/verification/workspaces/latest.json',JSON.stringify(proof,null,2),{mode:0o600});
  console.log('PASS: personal signup → $5 mock credit → own key → three MCP calls → $4.97 → $0.03 author payout; three mock rail matches (two funding receipts plus payout); caps, isolation, replay and revocation.');
}finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));db.close();rmSync(directory,{recursive:true,force:true});}
