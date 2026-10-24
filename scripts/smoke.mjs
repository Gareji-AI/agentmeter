import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// A fresh process and ledger prove bootstrap, not just imported test fixtures.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const dir=await mkdtemp(join(tmpdir(),'agentmeter-smoke-'));
const began=performance.now();
const child=spawn(process.execPath,['src/server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,
  PAYPAL_MODE:'mock',PAYPAL_API_BASE:'https://api-m.sandbox.paypal.com',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:'',
  PAYPAL_PAYOUT_CLIENT_ID:'',PAYPAL_PAYOUT_CLIENT_SECRET:'',PAYPAL_WEBHOOK_ID:'',PAYPAL_SANDBOX_RECIPIENT:'author@example.com',
  GEMINI_API_KEY:'',AG_GRID_LICENSE_KEY:'',AG_STUDIO_LICENSE_KEY:'',PAYOUT_MODE:'execute',
  DATABASE_PATH:join(dir,'ledger.sqlite'),PORT:'0',HOST:'127.0.0.1',PUBLIC_BASE_URL:'http://localhost:0'}});
let output='';let errors='';child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
try {
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server readiness timeout')),10000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${errors}`));});
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/AgentMeter: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
  });
  const startupMs=Math.round(performance.now()-began);
  const first=await fetch(base);assert.equal(first.status,200);
  const cookie=first.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
  const send=async(path,body,key)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(response.status,200,`${path} must succeed`);return response;
  };
  for(const path of ['/health','/app','/provider','/reconcile','/grid','/assets/app.js','/assets/app.css','/assets/grid.js','/assets/studio.js'])await send(path);
  let state=await(await send('/api/state')).json();
  assert.equal(state.mode,'mock');assert.equal(state.buyer.balance_micro,5_000_000);assert.equal(state.provider.balance_micro,0);assert.equal(state.tools.length,6);assert.equal(state.calls.length,180);
  const run=await(await send('/api/demo',{},'smoke-three-calls')).json();assert.equal(run.results.length,3);
  await send('/api/demo',{},'smoke-three-calls');
  state=await(await send('/api/state')).json();assert.equal(state.buyer.balance_micro,4_970_000);assert.equal(state.provider.balance_micro,30_000);
  const payout=await(await send('/api/payout',{})).json();assert.equal(payout.status,'SUCCESS');assert.equal(payout.amount_micro,30_000);
  const report=await(await send('/api/reconcile')).json();assert.equal(report.matched,2);assert.equal(report.rows.length,2);assert.ok(report.rows.every(row=>row.status==='MATCH'));
  state=await(await send('/api/state')).json();assert.equal(state.provider.balance_micro,0);
  console.log(`PASS — fresh seeded process; all screens/assets; $5.00 → $4.97; $0.03 author payout; 2 mock receipt matches. Startup: ${startupMs} ms (local process, not hosting wake-up).`);
}finally{
  if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
  await rm(dir,{recursive:true,force:true});
}
