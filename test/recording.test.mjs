import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { createApplication } from '../src/server.mjs';
import { recordingEnvironment } from '../scripts/recording.mjs';

test('recording isolates sandbox credentials and keeps local browser origins working while only widgets use Gemini',async t=>{
  const env=recordingEnvironment({PAYPAL_MODE:'sandbox',PUBLIC_BASE_URL:'https://hosted.example',
    DATABASE_PATH:'never-open-this.sqlite',PAYPAL_CLIENT_ID:'never-send',PAYPAL_CLIENT_SECRET:'never-send',
    GEMINI_API_KEY:'fixture-model-key'},':memory:');
  assert.equal(env.PAYPAL_MODE,'mock');assert.equal(env.PAYPAL_CLIENT_SECRET,'');
  const db=fixture();const app=createApplication({db,env});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.server.address().port}`;app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;
  t.after(()=>new Promise(r=>{app.server.closeAllConnections();app.server.close(()=>{db.close();r();});}));
  let modelCalls=0;const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://generativelanguage.googleapis.com/')){
      modelCalls++;return new Response(JSON.stringify({modelVersion:'fixture-model',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({metric:'calls',group_by:'tool_name',period:'30days',tool_name:null})}]}}]}));
    }
    return originalFetch(url,options);
  };t.after(()=>{globalThis.fetch=originalFetch;});
  const first=await fetch(base+'/app');const setCookie=first.headers.get('set-cookie');assert.ok(!setCookie.includes('Secure'));
  const cookie=setCookie.split(';')[0];
  const send=async(path,body)=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','Idempotency-Key':'recording-proof-'+path},body:body?JSON.stringify(body):undefined});
    assert.equal(response.status,200);return response.json();
  };
  const run=await send('/api/demo',{});assert.equal(run.results.length,3);
  assert.equal((await send('/api/narrate',{call_ids:run.results.map(r=>r.call.id)})).source,'deterministic planner');
  const budget=await send('/api/budget',{text:'Keep extract_entities under $0.00 this month'});assert.equal(budget.source,'validated rule parser');
  assert.equal(modelCalls,0);
  const state=await send('/api/state');assert.equal(state.buyer.balance_micro,4_970_000);assert.equal(state.provider.balance_micro,30_000);
  assert.equal(state.aiEnabled,false);assert.equal(state.widgetAiEnabled,true);
  const grid=await fetch(base+'/grid',{headers:{Cookie:cookie}}).then(r=>r.text());
  assert.match(grid,/Gemini receives the question/);assert.ok(!grid.includes('Semantic tool clusters'));assert.ok(!grid.includes('fixture-model-key'));
  assert.equal((await send('/api/widget',{text:'Compare calls by tool'})).source,'Gemini · validated intent');assert.equal(modelCalls,1);
});
