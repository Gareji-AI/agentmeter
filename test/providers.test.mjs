import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync,rmSync,readFileSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture,request } from './helpers.mjs';
import { createWorkspace } from '../src/workspaces.mjs';
import { createProvider,registerProviderTool,toolForOwner,setToolPublished,changeToolPrice,replaceToolCredential,providerSnapshot,updateProvider } from '../src/providers.mjs';
import { createGateway } from '../src/gateway.mjs';
import { openDb } from '../src/db.mjs';
import { assertLedger } from '../src/metering.mjs';
import { payOut } from '../src/payments.mjs';
import { openSecret } from '../src/upstream-secrets.mjs';
import { endpointUrl,resolveEndpoint,publicAddress } from '../src/upstream-http.mjs';
import { invokeUpstream } from '../src/upstream.mjs';
import { checkSchema,validateRemoteArgs } from '../src/upstream-schema.mjs';
import { createApplication } from '../src/server.mjs';
const schema={type:'object',properties:{text:{type:'string',maxLength:4000}},required:['text'],additionalProperties:false};
const input=(extra={})=>({name:'invoice_api',description:'Review a synthetic invoice.',kind:'http',endpoint:'https://provider.example.com/invoice',price_usd:'0.01',input_schema:schema,auth_mode:'none',auth_secret:'',read_only:true,...extra});
function seller(db){const workspace=createWorkspace(db,'Tool maker');const provider=createProvider(db,workspace.id,{name:'Invoice tools',paypal_email:'test-owner@example.com'});return {workspace,provider};}
function register(db,gateway,provider,extra={},options={}){return registerProviderTool(db,provider.id,input(extra),{key:gateway.key,...options});}
async function published(db,gateway,provider,extra={},options={}){const tool=register(db,gateway,provider,extra,options);await gateway.probe(toolForOwner(db,provider.id,tool.id),{text:'probe'});setToolPublished(db,provider.id,tool.id,true);return tool;}
const call=(tool,key='one',extra={})=>request(key,{toolName:tool.name,args:{text:'Invoice DEMO-101 $120.00'},maxPriceMicro:10000,...extra});
const close=server=>new Promise(r=>{server.closeAllConnections();server.close(r);});
async function upstream(t,handler){const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>close(server));return `http://127.0.0.1:${server.address().port}`;}

test('provider tools are private drafts until probed; pricing, namespace, schema and ownership are enforced',async t=>{
 const db=fixture();t.after(()=>db.close());const a=seller(db),b=seller(db),gateway=createGateway(db,{invoke:async()=>({ok:true})});
 const tool=register(db,gateway,a.provider);assert.match(tool.name,/^p_[a-f0-9]{12}_invoice_api$/);assert.equal(db.prepare('SELECT enabled FROM tools WHERE id=?').get(tool.id).enabled,0);
 assert.throws(()=>setToolPublished(db,a.provider.id,tool.id,true),/Test the connection/);
 assert.throws(()=>toolForOwner(db,b.provider.id,tool.id),/Unknown tool/);
 for(const price of [0,0.01,'0','1.000001','-0.01','0.1234567'])assert.throws(()=>register(db,gateway,a.provider,{name:'other',price_usd:price}));
 assert.throws(()=>register(db,gateway,a.provider,{read_only:false}));assert.throws(()=>register(db,gateway,a.provider,{input_schema:{type:'object',$ref:'other'}}));
 await gateway.probe(toolForOwner(db,a.provider.id,tool.id),{text:'probe'});setToolPublished(db,a.provider.id,tool.id,true);
 assert.equal(providerSnapshot(db,b.workspace.id,'https://agentmeter.example').tools.length,0);
 assert.equal(providerSnapshot(db,a.workspace.id,'https://agentmeter.example').tools.length,1);assertLedger(db);
});

test('remote quotes reject price increases before reserving; in-flight prices and owners are snapshotted; retries never execute twice',async t=>{
 const db=fixture();t.after(()=>db.close());const {provider}=seller(db);let invokes=0,finish;
 const gateway=createGateway(db,{invoke:async(_config,args)=>{invokes++;if(args.text==='probe')return {ok:true};return new Promise(r=>finish=r);}}),tool=await published(db,gateway,provider);
 changeToolPrice(db,provider.id,tool.id,'0.02');await assert.rejects(gateway.call(call(tool)),e=>e.code===-32007);assert.equal(invokes,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM calls').get().n,0);
 changeToolPrice(db,provider.id,tool.id,'0.01');const first=gateway.call(call(tool));await Promise.resolve();
 await assert.rejects(gateway.call(call(tool)),e=>e.message==='CALL_IN_PROGRESS');
 changeToolPrice(db,provider.id,tool.id,'0.03');finish({review:'ok'});const result=await first;assert.equal(result.call.price_micro,10000);
 setToolPublished(db,provider.id,tool.id,false);const replay=await gateway.call(call(tool));assert.equal(replay.reused,true);assert.equal(invokes,2);
 assert.equal(db.prepare('SELECT balance_micro FROM accounts WHERE id=?').get(provider.id).balance_micro,10000);assertLedger(db);
});

test('upstream errors release reservations without earnings; released calls and invalid arguments never execute again',async t=>{
 const db=fixture();t.after(()=>db.close());const {provider}=seller(db);let invokes=0;const gateway=createGateway(db,{invoke:async(_config,args)=>{invokes++;if(args.text==='probe')return {};throw Error('Remote unavailable');}}),tool=await published(db,gateway,provider);
 await assert.rejects(gateway.call(call(tool,'bad',{args:{text:4}})),e=>e.code===-32602);assert.equal(invokes,1);
 await assert.rejects(gateway.call(call(tool)),e=>e.code===-32006);await assert.rejects(gateway.call(call(tool)),/CALL_RELEASED/);assert.equal(invokes,2);
 const buyer=db.prepare("SELECT * FROM accounts WHERE id='buyer'").get();assert.equal(buyer.balance_micro,5000000);assert.equal(buyer.reserved_micro,0);assert.equal(db.prepare('SELECT balance_micro FROM accounts WHERE id=?').get(provider.id).balance_micro,0);assertLedger(db);
});

test('remote secrets are encrypted, bound to their owner and survive database reopen; rotation pauses publication',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'agentmeter-provider-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'ledger.sqlite');let db=fixture(5000000,openDb(file));
 const {provider,workspace}=seller(db);let gateway=createGateway(db,{invoke:async config=>{assert.equal(config.secret,'synthetic-secret-123');return {};}});const tool=await published(db,gateway,provider,{auth_mode:'bearer',auth_secret:'synthetic-secret-123'});
 const raw=toolForOwner(db,provider.id,tool.id);assert.ok(!raw.auth_cipher.includes('synthetic-secret'));assert.throws(()=>openSecret(gateway.key,raw.auth_cipher,tool.id+'\0wrong-owner'));assert.ok(!JSON.stringify(providerSnapshot(db,workspace.id,'https://agentmeter.example')).includes(raw.auth_cipher));
 db.close();db=openDb(file);t.after(()=>db.close());gateway=createGateway(db,{invoke:async config=>({authenticated:config.secret==='synthetic-secret-123'})});assert.equal((await gateway.call(call(tool))).result.authenticated,true);
 assert.equal(statSync(file+'.upstream-key').mode&0o777,0o600);assert.equal(readFileSync(file+'.upstream-key').length,32);
 replaceToolCredential(db,provider.id,tool.id,{auth_mode:'x-api-key',auth_secret:'replacement'},gateway.key);assert.equal(toolForOwner(db,provider.id,tool.id).enabled,0);assert.throws(()=>setToolPublished(db,provider.id,tool.id,true));assertLedger(db);
});

test('SSRF controls reject private, metadata, mapped and mixed DNS addresses and pin one vetted resolution',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.20.0.1','192.168.1.1','100.64.0.1','::1','fc00::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::'])assert.equal(publicAddress(address),false,address);
 for(const value of ['http://example.com','https://127.1','https://2130706433','https://localhost','https://metadata.internal','https://a:b@example.com','https://example.com/?secret=x','https://example.com:8443','https://api.paypal.com'])assert.throws(()=>endpointUrl(value));
 assert.throws(()=>endpointUrl('https://agentmeter.example/api/payout',{base:'https://agentmeter.example'}));
 await assert.rejects(resolveEndpoint('https://provider.example',{resolve:async()=>[{address:'8.8.8.8',family:4},{address:'::1',family:6}]}),/private/);
 let lookups=0;const vetted=await resolveEndpoint('https://provider.example',{resolve:async()=>{lookups++;return [{address:'8.8.8.8',family:4}];}});const ip=await new Promise((resolve,reject)=>vetted.lookup('provider.example',{},(error,address)=>error?reject(error):resolve(address)));assert.equal(ip,'8.8.8.8');assert.equal(lookups,1);
});

test('real HTTP proxy forwards JSON, a stable execution ID and private authentication; redirects, overflow, scalar and credential echoes fail',async t=>{
 let hits=0;const endpoint=await upstream(t,async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const data=JSON.parse(Buffer.concat(chunks));hits++;assert.equal(req.headers.authorization,'Bearer private-test-secret');assert.equal(req.headers['idempotency-key'],'execution-123');
 res.setHeader('Content-Type','application/json');if(data.text==='redirect'){res.writeHead(302,{Location:'http://127.0.0.1/private'});res.end();}else res.end(JSON.stringify(data.text==='large'?{text:'x'.repeat(140000)}:data.text==='scalar'?true:data.text==='echo'?{secret:'private-test-secret'}:{invoice:data.text}));});
 const config={kind:'http',endpoint,auth_mode:'bearer',secret:'private-test-secret',requestId:'execution-123'};
 assert.deepEqual(await invokeUpstream(config,{text:'DEMO-101'},{allowLoopback:true}),{invoice:'DEMO-101'});
 for(const text of ['redirect','large','scalar','echo'])await assert.rejects(invokeUpstream(config,{text},{allowLoopback:true}));assert.equal(hits,5);
});

test('MCP client initializes sessions, handles progress and SSE results, forwards only the selected tool and deletes the session',async t=>{
 const methods=[];let deleted=false;const endpoint=await upstream(t,async(req,res)=>{
 if(req.method==='DELETE'){deleted=true;assert.equal(req.headers['mcp-session-id'],'session-test');res.writeHead(204);return res.end();}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const message=JSON.parse(Buffer.concat(chunks));methods.push(message.method);
 if(message.method!=='initialize'){assert.equal(req.headers['mcp-session-id'],'session-test');assert.equal(req.headers['mcp-protocol-version'],'2025-11-25');}
 if(message.method==='notifications/initialized'){res.writeHead(202);return res.end();}
 res.setHeader('Content-Type','application/json');let result;
 if(message.method==='initialize'){res.setHeader('Mcp-Session-Id','session-test');result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'Independent test',version:'1'}};}
 else if(message.method==='tools/list')result={tools:[{name:'review_invoice',inputSchema:schema}]};
 else {assert.equal(message.params.name,'review_invoice');assert.equal(req.headers['idempotency-key'],'execution-mcp');res.setHeader('Content-Type','text/event-stream');res.write('data: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{progress:1}})+'\n\n');res.write('data: '+JSON.stringify({jsonrpc:'2.0',id:message.id,result:{content:[{type:'text',text:'Reviewed invoice'}],structuredContent:{invoice:'DEMO-101'}}})+'\n\n');return;}
 res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));});
 const result=await invokeUpstream({kind:'mcp',endpoint,remote_tool:'review_invoice',auth_mode:'none',secret:'',requestId:'execution-mcp'},{text:'test'},{allowLoopback:true});assert.deepEqual(result,{invoice:'DEMO-101'});assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','tools/call']);assert.equal(deleted,true);
});

test('upstream deadlines release network connections and MCP isError is a failure',async t=>{
 const endpoint=await upstream(t,async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const m=JSON.parse(Buffer.concat(chunks));if(!m.method)return;res.setHeader('Content-Type','application/json');if(m.method==='notifications/initialized'){res.writeHead(202);return res.end();}res.end(JSON.stringify({jsonrpc:'2.0',id:m.id,result:m.method==='initialize'?{protocolVersion:'2025-11-25'}:m.method==='tools/list'?{tools:[{name:'fail'}]}:{isError:true,content:[{type:'text',text:'failed'}]}}));});
 await assert.rejects(invokeUpstream({kind:'http',endpoint},{text:'wait'},{allowLoopback:true,timeout:50}),/deadline/);
 await assert.rejects(invokeUpstream({kind:'mcp',endpoint,remote_tool:'fail'},{text:'test'},{allowLoopback:true}),/reported an error/);
});

test('schema subset validates nested arrays, enums and explicit bounds before remote execution',()=>{
 const nested=checkSchema({type:'object',properties:{rows:{type:'array',maxItems:2,items:{type:'object',properties:{amount:{type:'integer',minimum:1,maximum:20},currency:{type:'string',enum:['USD']}},required:['amount','currency']}}},required:['rows']});
 assert.deepEqual(validateRemoteArgs(nested,{rows:[{amount:10,currency:'USD'}]}),{rows:[{amount:10,currency:'USD'}]});
 for(const value of [{rows:[{amount:0,currency:'USD'}]},{rows:[{amount:2,currency:'JPY'}]},{rows:[{}, {}, {}]},{rows:'bad'}])assert.throws(()=>validateRemoteArgs(nested,value));
 for(const property of ['_request_id','_max_price_micro','constructor'])assert.throws(()=>checkSchema({type:'object',properties:{[property]:{type:'string'}}}));
});

async function appSetup(t){const db=fixture(),app=createApplication({db,env:{PAYPAL_MODE:'mock',PUBLIC_WORKSPACES:'1',DEMO_ACCESS_TOKEN:'operator',TEST_UPSTREAM_LOOPBACK:'1'}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;t.after(async()=>{await close(app.server);db.close();});return {...app,base};}
function client(app){let cookie='';return {async send(path,body,headers={}){const r=await fetch(app.base+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Cookie:cookie,Origin:app.base,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;},async json(path,body,headers){const r=await this.send(path,body,headers),v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;}};}

test('provider HTTP lifecycle isolates authors and supports API + MCP paid calls, safe replay, failure and payout',async t=>{
 const app=await appSetup(t),a=client(app),b=client(app);await a.json('/api/customer/workspaces',{name:'Owner A'});await b.json('/api/customer/workspaces',{name:'Owner B'});
 await a.json('/api/customer/provider/profile',{name:'Author A',paypal_email:'a@example.com'});await b.json('/api/customer/provider/profile',{name:'Author B',paypal_email:'b@example.com'});
 const tools=[];for(const kind of ['http','mcp']){const tool=await a.json('/api/customer/provider/tools',input({name:'invoice_'+kind,kind,endpoint:app.base+'/examples/invoice-'+(kind==='http'?'api':'mcp'),remote_tool:'invoice_review'}));assert.equal((await a.send(`/api/customer/provider/tools/${tool.id}/publish`,{published:true})).status,400);await a.json(`/api/customer/provider/tools/${tool.id}/test`,{arguments:{text:'Invoice DEMO-101. Total $120.00.'}});await a.json(`/api/customer/provider/tools/${tool.id}/publish`,{published:true});tools.push(tool);}
 assert.equal((await b.send(`/api/customer/provider/tools/${tools[0].id}/price`,{price_usd:'0.5'})).status,400);
 const key=(await a.json('/api/customer/keys',{label:'Client-only'})).key;
 assert.equal((await client(app).send('/api/customer/provider/payouts',{}, {Authorization:'Bearer '+key})).status,401);
 assert.equal((await client(app).send('/sell')).headers.get('location'),'/sign-in');
 const run=(tool,args,key='buyer-key')=>a.json('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool.name,arguments:args}},{Authorization:'Bearer '+key,Accept:'application/json, text/event-stream'});
 const args={text:'Invoice DEMO-101. Total $120.00.',_request_id:'api-1',_max_price_micro:10000};
 assert.equal((await run(tools[0],{text:'missing metadata'})).error.code,-32602);assert.equal((await run(tools[0],{...args,_max_price_micro:1})).error.code,-32007);
 for(const [i,tool] of [tools[0],tools[1],tools[0]].entries())assert.equal((await run(tool,{...args,_request_id:'paid-'+i})).result._meta.agentmeter.price_micro,10000);
 assert.equal((await run(tools[0],{...args,_request_id:'paid-0'})).result._meta.agentmeter.charged_this_request_micro,0);
 assert.equal((await run(tools[0],{...args,text:'FAIL_UPSTREAM',_request_id:'failed'})).error.code,-32006);
 const own=await a.json('/api/customer/provider/state'),other=await b.json('/api/customer/provider/state');assert.equal(own.provider.balance_micro,30000);assert.equal(other.provider.balance_micro,0);assert.equal(other.calls.length,0);assert.equal(own.calls.filter(c=>c.status==='SETTLED').length,3);
 const payout=await a.json('/api/customer/provider/payouts',{});assert.equal(payout.status,'SUCCESS');assert.equal(payout.amount_micro,30000);assert.equal((await a.json('/api/customer/provider/state')).provider.balance_micro,0);assert.equal((await b.json('/api/customer/provider/state')).payouts.length,0);
 const html=await(await a.send('/sell')).text();assert.match(html,/Your API\. Your price/);assert.ok(!html.includes('Author B'));assertLedger(app.db);
});

test('remote balance exhaustion and monthly caps prevent network work before reservation',async t=>{
 const db=fixture(10000);t.after(()=>db.close());const {provider}=seller(db);let calls=0;const gateway=createGateway(db,{invoke:async()=>{calls++;return {};}}),tool=await published(db,gateway,provider);
 db.prepare("UPDATE accounts SET monthly_cap_micro=0 WHERE id='buyer'").run();await assert.rejects(gateway.call(call(tool,'cap')),e=>e.code===-32004);assert.equal(calls,1);
 db.prepare("UPDATE accounts SET monthly_cap_micro=NULL WHERE id='buyer'").run();await gateway.call(call(tool,'spent'));await assert.rejects(gateway.call(call(tool,'empty')),e=>e.code===-32002);assert.equal(calls,2);assertLedger(db);
});


test('a pending provider payout locks its recipient and preserves funds across repeated polling',async t=>{
 const db=fixture();t.after(()=>db.close());const {provider,workspace}=seller(db),gateway=createGateway(db,{invoke:async()=>({ok:true})}),tool=await published(db,gateway,provider);await gateway.call(call(tool));
 let sends=0,polls=0;const pending={batch_header:{payout_batch_id:'PENDING-BATCH',batch_status:'PENDING'},items:[]};const paypal={async createPayout(){sends++;return pending;},async getPayout(id){polls++;assert.equal(id,'PENDING-BATCH');return pending;}};
 const payout=await payOut(db,paypal,provider.id);assert.equal(payout.status,'SENT');assert.throws(()=>updateProvider(db,workspace.id,{name:'Changed',paypal_email:'different@example.com'}),/pending payout/);
 await payOut(db,paypal,provider.id);assert.equal(sends,1);assert.equal(polls,1);const account=db.prepare('SELECT * FROM accounts WHERE id=?').get(provider.id);assert.equal(account.balance_micro,10000);assert.equal(account.reserved_micro,10000);assert.equal(account.paypal_email,'test-owner@example.com');assertLedger(db);
});
