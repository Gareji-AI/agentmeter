import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './helpers.mjs';
import { createApplication } from '../src/server.mjs';
import { openDb } from '../src/db.mjs';
import { assertLedger,accountForKey } from '../src/metering.mjs';
import { workspaceSession } from '../src/workspaces.mjs';

async function start(db) {
  const app=createApplication({db,env:{PAYPAL_MODE:'mock',PUBLIC_WORKSPACES:'1',DEMO_ACCESS_TOKEN:'operator-only'}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.server.address().port}`;app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;
  return {...app,base,close:()=>new Promise(r=>{app.server.closeAllConnections();app.server.close(r);})};
}
function client(app,cookie='') {
  return {get cookie(){return cookie;},async send(path,body,headers={}){
    const response=await fetch(app.base+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Cookie:cookie,Origin:app.base,'Content-Type':'application/json','Idempotency-Key':'topup-test',...headers},body:body===undefined?undefined:JSON.stringify(body)});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  },async json(path,body,headers={}){const response=await this.send(path,body,headers);const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;}};
}
async function setup(t) {const db=fixture(),app=await start(db);t.after(async()=>{await app.close();db.close();});return app;}
async function signup(app,name='Invoice assistant') {const user=client(app);const created=await user.json('/api/customer/workspaces',{name});return {user,created};}
const rpc=(user,key,id,args={text:'Invoice DEMO-101. Total $120.00. Due 2026-11-12.',_request_id:'invoice-once'})=>user.json('/mcp',{jsonrpc:'2.0',id,method:'tools/call',params:{name:'extract_entities',arguments:args}},{Authorization:`Bearer ${key}`,Accept:'application/json, text/event-stream','Idempotency-Key':''});
async function fund(user){const topup=await user.json('/api/customer/topups',{amount:'5.00'});await user.json('/api/customer/mock/approve',{topup_id:topup.id});return topup;}

test('public workspaces start empty and isolate keys, operator routes, HTML and other customer data',async t=>{
  const app=await setup(t),a=await signup(app,'<img src=x onerror=alert(1)>'),b=await signup(app,'Other workspace');
  const issued=await a.user.json('/api/customer/keys',{label:'Codex'}),own=await a.user.json('/api/customer/state');
  assert.equal(own.account.balance_micro,0);assert.equal(own.calls.length,0);assert.equal(own.topups.length,0);
  assert.ok(!JSON.stringify(own).includes(issued.key));assert.ok(!JSON.stringify(own).includes(a.created.recovery_code));
  const other=await b.user.json('/api/customer/state');assert.equal(other.keys.length,0);assert.ok(!JSON.stringify(other).includes(issued.id));
  const html=await(await a.user.send('/workspace')).text();assert.match(html,/&lt;img/);assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes(issued.key));assert.ok(!html.includes('Other workspace'));
  for(const path of ['/api/state','/api/reconcile','/events'])assert.equal((await a.user.send(path)).status,401);
  for(const path of ['/api/payout','/api/widget','/api/classify'])assert.equal((await a.user.send(path,{})).status,401);
  assert.equal((await client(app).send('/api/customer/state',undefined,{Authorization:`Bearer ${issued.key}`})).status,401);
  assert.equal((await client(app).send('/api/narrate',{call_ids:[]},{Authorization:`Bearer ${issued.key}`})).status,401);
  assert.equal((await a.user.send('/api/session',{token:'anything'})).status,401);
  const placeholder=app.db.prepare('SELECT api_key FROM accounts WHERE id=?').get(a.created.id).api_key;
  assert.throws(()=>accountForKey(app.db,placeholder));assert.throws(()=>accountForKey(app.db,a.created.recovery_code));assertLedger(app.db);
});

test('public funding is replay-safe and customer MCP calls use explicit execution IDs across RPC request reuse',async t=>{
  const app=await setup(t),a=await signup(app),b=await signup(app,'Second');const key=(await a.user.json('/api/customer/keys',{label:'Codex'})).key;
  const empty=await rpc(a.user,key,1);assert.equal(empty.error.code,-32002);assert.equal(empty.error.data.topup_url,app.base+'/workspace#funds');
  const topup=await a.user.json('/api/customer/topups',{amount:'5.00'});assert.equal((await a.user.json('/api/customer/state')).account.balance_micro,0);
  assert.match(await(await a.user.send('/paypal/return?token='+topup.order_id)).text(),/Capture approved top-up/);
  assert.ok(!(await(await b.user.send('/paypal/return?token='+topup.order_id)).text()).includes(topup.id));
  assert.equal((await a.user.send('/app?checkout=cancelled')).headers.get('location'),'/workspace#funds');
  assert.equal((await b.user.send('/api/customer/mock/approve',{topup_id:topup.id})).status,400);
  assert.equal((await b.user.send(`/api/customer/topups/${topup.id}/capture`,{})).status,400);
  await a.user.json('/api/customer/mock/approve',{topup_id:topup.id});await a.user.json(`/api/customer/topups/${topup.id}/capture`,{});
  assert.equal((await a.user.json('/api/customer/state')).account.balance_micro,5_000_000);
  const listed=await a.user.json('/mcp',{jsonrpc:'2.0',id:3,method:'tools/list'},{Authorization:`Bearer ${key}`,Accept:'application/json, text/event-stream'});assert.ok(listed.result.tools[0].inputSchema.required.includes('_request_id'));
  assert.equal((await rpc(a.user,key,4,{text:'sample'})).error.code,-32602);
  const first=await rpc(a.user,key,5),replay=await rpc(a.user,key,999);assert.equal(replay.result._meta.agentmeter.reused,true);assert.equal(first.result._meta.agentmeter.call_id,replay.result._meta.agentmeter.call_id);
  assert.equal(first.result.structuredContent._agentmeter_receipt.charged_this_request_micro,10_000);assert.equal(replay.result.structuredContent._agentmeter_receipt.charged_this_request_micro,0);
  assert.equal(JSON.parse(replay.result.content[0].text)._agentmeter_receipt.balance_available_micro,4_990_000);
  assert.deepEqual(first.result.structuredContent.money,['$120.00']);
  await rpc(a.user,key,5,{text:'next intended call',_request_id:'invoice-second'});
  assert.equal((await rpc(a.user,key,6,{text:'changed',_request_id:'invoice-once'})).error.code,-32003);
  const state=await a.user.json('/api/customer/state');assert.equal(state.account.balance_micro,4_980_000);assert.equal(state.calls.length,2);assert.equal(app.db.prepare("SELECT balance_micro FROM accounts WHERE id='author'").get().balance_micro,20_000);
  const other=await b.user.json('/api/customer/state');assert.equal(other.account.balance_micro,0);assert.equal(other.calls.length,0);assert.equal(other.topups.length,0);assertLedger(app.db);
});

test('revocation is owner-scoped and client keys cannot sign in or change credit management',async t=>{
  const app=await setup(t),a=await signup(app),b=await signup(app,'Second'),issued=await a.user.json('/api/customer/keys',{label:'Codex'});
  assert.equal((await b.user.send(`/api/customer/keys/${issued.id}/revoke`,{})).status,400);
  assert.equal(accountForKey(app.db,issued.key).id,a.created.id);
  assert.equal((await b.user.send('/api/customer/session',{recovery_code:issued.key})).status,401);
  await a.user.json(`/api/customer/keys/${issued.id}/revoke`,{});assert.throws(()=>accountForKey(app.db,issued.key));
  assert.equal((await a.user.send('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'},{Authorization:`Bearer ${issued.key}`,Accept:'application/json, text/event-stream'})).status,401);
  for(let i=0;i<5;i++)await a.user.json('/api/customer/keys',{label:'client '+i});
  assert.equal((await a.user.send('/api/customer/keys',{label:'sixth active key'})).status,400);
});

test('customer monthly caps apply before tool execution and cannot be changed using a client key',async t=>{
  const app=await setup(t),{user}=await signup(app);await fund(user);const issued=await user.json('/api/customer/keys',{label:'Codex'});
  await user.json('/api/customer/budget',{amount:'0.00'});assert.equal((await rpc(user,issued.key,1)).error.code,-32004);
  for(const amount of ['-1','NaN','0.1234567',1])assert.equal((await user.send('/api/customer/budget',{amount})).status,400);
  await user.json('/api/customer/budget',{amount:'0.01'});assert.ok((await rpc(user,issued.key,2)).result);
  assert.equal((await rpc(user,issued.key,3,{text:'another',_request_id:'another'})).error.code,-32004);
  const state=await user.json('/api/customer/state');assert.equal(state.account.balance_micro,4_990_000);assert.equal(state.account.reserved_micro,0);
  assert.equal((await client(app).send('/api/budget',{text:'Keep all tools under $100 this month'},{Authorization:`Bearer ${issued.key}`})).status,401);assertLedger(app.db);
});

test('recovery, session and client credentials survive reopen as hashes; logout invalidates the session',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'agentmeter-workspace-')),path=join(dir,'ledger.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let db=fixture(5_000_000,openDb(path)),app=await start(db);const {user,created}=await signup(app);const issued=await user.json('/api/customer/keys',{label:'Codex'}),cookie=user.cookie;
  const stored=JSON.stringify(['workspace_credentials','workspace_sessions','client_keys'].map(table=>db.prepare('SELECT * FROM '+table).all()));
  for(const value of [created.recovery_code,issued.key,cookie.split('=')[1]])assert.ok(!stored.includes(value));
  await app.close();db.close();db=openDb(path);app=await start(db);t.after(async()=>{await app.close();db.close();});
  const resumed=client(app,cookie);assert.equal((await resumed.json('/api/customer/state')).account.id,created.id);assert.equal(accountForKey(db,issued.key).id,created.id);
  await resumed.json('/api/customer/logout',{});assert.equal(workspaceSession(db,cookie),null);assert.equal((await resumed.send('/api/customer/state')).status,401);
  const signedIn=client(app);await signedIn.json('/api/customer/session',{recovery_code:created.recovery_code});assert.equal((await signedIn.json('/api/customer/state')).account.id,created.id);
  db.prepare('UPDATE workspace_sessions SET expires_at=0').run();assert.equal((await signedIn.send('/api/customer/state')).status,401);
});

test('public entry rejects cross-origin writes, oversized inputs and signup bursts',async t=>{
  const app=await setup(t),user=client(app);
  assert.equal((await user.send('/api/customer/workspaces',{name:'cross-site'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await user.send('/api/customer/workspaces',{name:'a'.repeat(5000)})).status,413);
  assert.equal((await user.send('/api/customer/workspaces',{name:'bad type'},{'Content-Type':'text/plain'})).status,415);
  for(let i=0;i<19;i++)assert.equal((await user.send('/api/customer/workspaces',{name:'test '+i})).status,201);
  assert.equal((await user.send('/api/customer/workspaces',{name:'too many'})).status,429);
});
