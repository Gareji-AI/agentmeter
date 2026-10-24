import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fixture } from './helpers.mjs';
import { handleMcp } from '../src/mcp.mjs';

async function setup(t,balance) {
  const db=fixture(balance);const server=createServer((req,res)=>handleMcp(req,res,{db,publicBaseUrl:`http://127.0.0.1:${server.address().port}`}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(()=>{db.close();r();});}));
  const url=`http://127.0.0.1:${server.address().port}/mcp`;
  return {db,url,send:(message,headers={})=>fetch(url,{method:'POST',headers:{Authorization:'Bearer buyer-key','Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body:JSON.stringify(message)})};
}
test('MCP initialize, notification, listing and metered replay work over HTTP',async t=>{
  const {send}=await setup(t);
  const init=await (await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}})).json();
  assert.equal(init.result.protocolVersion,'2025-11-25');
  assert.equal((await send({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  assert.equal((await (await send({jsonrpc:'2.0',id:2,method:'tools/list'})).json()).result.tools.length,6);
  const msg={jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'extract_entities',arguments:{text:'hello'}}};
  const a=await(await send(msg)).json();const b=await(await send(msg)).json();
  assert.equal(a.result._meta.agentmeter.call_id,b.result._meta.agentmeter.call_id);assert.equal(b.result._meta.agentmeter.reused,true);
});
test('MCP errors preserve insufficient funds code and absolute topup URL',async t=>{
  const {send,url}=await setup(t,0);
  const response=await(await send({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'extract_entities',arguments:{text:'hello'}}})).json();
  assert.equal(response.error.code,-32002);assert.equal(new URL(response.error.data.topup_url).origin,new URL(url).origin);
});
test('MCP rejects unknown origins, missing auth, malformed requests and unsupported transports',async t=>{
  const {send,url}=await setup(t);
  assert.equal((await send({}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await send({}, {Authorization:''})).status,401);
  assert.equal((await send([])).status,400);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer buyer-key'}})).status,405);
  assert.equal((await send({jsonrpc:'2.0',method:'tools/call',params:{name:'extract_entities',arguments:{text:'hi'}}})).status,400);
});
