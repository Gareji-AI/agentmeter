import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runStudioSession } from '../src/public/studio-session.js';

function session(work){const listeners=new Set();return {status:'idle',messages:[],addEventListener(_,fn){listeners.add(fn);},removeEventListener(_,fn){listeners.delete(fn);},notify(){for(const fn of listeners)fn();},sendMessage(){this.status='running';this.notify();queueMicrotask(()=>work(this));},cancel(){this.status='idle';this.notify();},get listeners(){return listeners.size;}};}
test('Studio submission waits for completion and propagates errors instead of a premature success',async()=>{
  let complete;
  const running=session(s=>{complete=()=>{s.status='idle';s.notify();};});
  let settled=false;const result=runStudioSession(running,'Show calls').then(()=>{settled=true;});
  await Promise.resolve();assert.equal(settled,false);complete();await result;assert.equal(running.listeners,0);
  const failure=session(s=>{s.messages=[{parts:[{type:'error',message:'Page agent rejected the request'}]}];s.status='error';s.notify();});
  await assert.rejects(runStudioSession(failure,'Show calls'),/Page agent rejected/);assert.equal(failure.listeners,0);
});
test('a hung Studio run times out, cancels and removes its listener',async()=>{
  const hung=session(()=>{});await assert.rejects(runStudioSession(hung,'Show calls',5),/timed out/);
  assert.equal(hung.status,'idle');assert.equal(hung.listeners,0);
});
