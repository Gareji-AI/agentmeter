import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { createApplication } from '../src/server.mjs';
import { createPayPal } from '../src/paypal.mjs';

export async function running(t,env={}) {
  const db=fixture();const paypal=createPayPal({PAYPAL_MODE:'mock'},{db});const app=createApplication({db,paypal,env});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.ctx.publicBaseUrl=`http://127.0.0.1:${app.server.address().port}`;paypal.config.publicBaseUrl=app.ctx.publicBaseUrl;
  t.after(()=>new Promise(r=>{app.server.closeAllConnections();app.server.close(()=>{db.close();r();});}));
  const home=await fetch(app.ctx.publicBaseUrl);const cookie=home.headers.get('set-cookie').split(';')[0];
  const send=(path,body,key)=>fetch(app.ctx.publicBaseUrl+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {...app,send};
}
test('expired trials reach the browser as enabled, keyless evaluation only on analytics',async t=>{
  const expired='[TRIAL]_fixture_[v3]_[0102]_'+Buffer.from('0').toString('base64')+'0'.repeat(32);
  const {send}=await running(t,{AG_GRID_LICENSE_KEY:expired,AG_STUDIO_LICENSE_KEY:expired});
  const html=await(await send('/grid')).text();
  const boot=JSON.parse(html.match(/<script type="application\/json" id="boot">(.*?)<\/script>/s)[1]);
  assert.equal(boot.analyticsEvaluation,true);assert.equal(boot.studioEnabled,true);
  assert.equal(boot.gridLicense,'');assert.equal(boot.studioLicense,'');
  assert.ok(!html.includes(expired));
  const buyer=await(await send('/app')).text();assert.ok(!buyer.includes('"analyticsEvaluation":true'));
});
test('HTTP demo completes calls, top-up, payout and reconciliation',async t=>{
  const {send}=await running(t);
  for(const path of ['/','/app','/provider','/reconcile','/grid'])assert.equal((await send(path)).status,200);
  const run=await(await send('/api/demo',{},'demo-run')).json();assert.equal(run.results.length,3);
  await send('/api/demo',{},'demo-run');
  let state=await(await send('/api/state')).json();assert.equal(state.buyer.balance_micro,4_970_000);assert.equal(state.provider.balance_micro,30_000);
  const payout=await(await send('/api/payout',{})).json();assert.equal(payout.status,'SUCCESS');
  const topup=await(await send('/api/topup',{amount:'5.00'},'topup')).json();
  assert.equal((await send('/api/mock/approve',{topup_id:topup.id})).status,200);
  const report=await(await send('/api/reconcile')).json();assert.equal(report.rows.filter(r=>r.status==='MATCH').length,2);
});
test('HTTP budget enforcement and Origin checks prevent unintended spending',async t=>{
  const {send,ctx}=await running(t);
  const budget=await(await send('/api/budget',{text:'Keep extract_entities under $0.00 this month'})).json();assert.equal(budget.intent.capMicro,0);
  const called=await(await send('/api/call',{name:'extract_entities',arguments:{text:'test'}},'blocked')).json();assert.equal(called.code,-32004);
  const denied=await fetch(ctx.publicBaseUrl+'/api/session',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
  assert.equal((await fetch(ctx.publicBaseUrl+'/api/state')).status,401);
  assert.equal((await send('/api/webhooks/paypal',{id:'forged',event_type:'PAYMENT.CAPTURE.COMPLETED',mock:true})).status,401);
});
