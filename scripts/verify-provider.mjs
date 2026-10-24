// Fresh mock proof: two registered public-style upstreams, three paid calls and own payout.
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,mkdirSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb } from '../src/db.mjs';
import { createApplication } from '../src/server.mjs';
import { seed } from './seed.mjs';
import { invoiceSchema } from '../src/example-upstreams.mjs';
import { assertLedger } from '../src/metering.mjs';
import { reconcile } from '../src/payments.mjs';
const dir=mkdtempSync(join(tmpdir(),'agentmeter-provider-proof-')),db=openDb(join(dir,'ledger.sqlite'));
const app=createApplication({db,env:{PAYPAL_MODE:'mock',PUBLIC_WORKSPACES:'1',TEST_UPSTREAM_LOOPBACK:'1'}});
try {
 await seed(db,app.paypal);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;
 let cookie='';const send=async(path,body,headers={})=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;};
 await send('/api/customer/workspaces',{name:'Invoice provider proof'});await send('/api/customer/provider/profile',{name:'Invoice Tools Studio',paypal_email:'author@example.com'});
 const tools=[];
 for(const kind of ['http','mcp']){const tool=await send('/api/customer/provider/tools',{name:'invoice_'+kind,description:'Review synthetic invoice text.',kind,endpoint:base+'/examples/invoice-'+(kind==='http'?'api':'mcp'),remote_tool:'invoice_review',price_usd:'0.01',input_schema:invoiceSchema,auth_mode:'none',auth_secret:'',read_only:true});await send(`/api/customer/provider/tools/${tool.id}/test`,{arguments:{text:'Invoice DEMO-PROBE. Total $120.00.'}});await send(`/api/customer/provider/tools/${tool.id}/publish`,{published:true});tools.push(tool);}
 const consumer=db.prepare("SELECT * FROM accounts WHERE id='consumer_demo'").get();assert.equal(consumer.balance_micro,5000000);
 const call=(tool,args)=>send('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool.name,arguments:args}},{Authorization:'Bearer '+consumer.api_key,Accept:'application/json, text/event-stream'});
 const requests=[tools[0],tools[1],tools[0]].map((tool,i)=>({tool,args:{text:`Invoice DEMO-10${i+1}. Total $120.00. Due 2026-11-12.`,_request_id:randomUUID(),_max_price_micro:10000}}));
 for(const request of requests)assert.equal((await call(request.tool,request.args)).result._meta.agentmeter.status,'SETTLED');
 assert.equal((await call(requests[0].tool,requests[0].args)).result._meta.agentmeter.charged_this_request_micro,0);
 assert.equal((await call(tools[0],{text:'FAIL_UPSTREAM',_request_id:randomUUID(),_max_price_micro:10000})).error.code,-32006);
 const earned=await send('/api/customer/provider/state');assert.equal(earned.provider.balance_micro,30000);assert.equal(db.prepare('SELECT balance_micro FROM accounts WHERE id=?').get(consumer.id).balance_micro,4970000);
 const payout=await send('/api/customer/provider/payouts',{});assert.equal(payout.status,'SUCCESS');assert.equal(payout.amount_micro,30000);const after=await send('/api/customer/provider/state');assert.equal(after.provider.balance_micro,0);assert.equal(after.provider.reserved_micro,0);
 const report=await reconcile(db,app.paypal);assert.equal(report.matched,2);assertLedger(db);
 const proof={at:new Date().toISOString(),pass:true,mode:'mock',upstreams:['JSON HTTP API','Streamable HTTP MCP'],successful_calls:3,retry_charge_micro:0,failed_call_charge_micro:0,initial_buyer_micro:5000000,final_buyer_micro:4970000,provider_earned_micro:30000,payout_micro:payout.amount_micro,payout_status:payout.status,report_matches:report.matched};
 mkdirSync('data/verification/providers',{recursive:true});writeFileSync('data/verification/providers/mock-latest.json',JSON.stringify(proof,null,2),{mode:0o600});console.log('PASS: register → test → publish HTTP + MCP → three successful paid calls → $4.97 buyer / $0.03 provider → own mock payout SUCCESS → two reconciled rail receipts; replay and upstream failure charge zero.');
}finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
