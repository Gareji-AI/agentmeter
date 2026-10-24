// Real inference is an explicit check, never part of the offline test suite.
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { interpretWidget } from '../src/ai.mjs';
import { BUILTIN_TOOLS } from '../src/tools.mjs';
import { ledgerIdentity } from './verify-deployment.mjs';

try{process.loadEnvFile();}catch(error){if(error.code!=='ENOENT')throw error;}
const flag=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1];};
const base=flag('--base');
const cases=[
  {text:'Plot what I paid each calendar day during the current month.',expected:{metric:'spend_micro',group_by:'day',period:'month',tool_name:null}},
  {text:'Compare the number of invocations for each utility over the last 30 days.',expected:{metric:'calls',group_by:'tool_name',period:'30days',tool_name:null}},
  {text:'For extract_entities, chart daily author earnings this month.',expected:{metric:'author_micro',group_by:'day',period:'month',tool_name:'extract_entities'}}
];
const rows=[];let before;let after;
async function request(path,body){
  const response=await fetch(new URL(path,base),{method:body?'POST':'GET',headers:{'X-Demo-Token':process.env.DEMO_ACCESS_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Hosted check returned HTTP ${response.status}`);
  return response.json();
}
try{
  if(base){const url=new URL(base);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error('Use HTTPS or a loopback test server');if(!process.env.DEMO_ACCESS_TOKEN)throw Error('DEMO_ACCESS_TOKEN is required');before=ledgerIdentity(await request('/api/state'));}
  else if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY is required');
  for(const item of cases){
    const began=performance.now();
    const result=base?await request('/api/widget',{text:item.text}):await interpretWidget(process.env,item.text,BUILTIN_TOOLS);
    assert.equal(result.source,'Gemini · validated intent','Rule fallback does not verify a model');
    assert.ok(result.model,'Provider model identity is required');
    for(const [key,value]of Object.entries(item.expected))assert.equal(result[key],value,`${key} differs for the verification prompt`);
    rows.push({prompt:item.text,intent:result,latency_ms:Math.round(performance.now()-began),pass:true});
    console.log(`PASS: ${item.expected.metric} / ${item.expected.group_by} / ${item.expected.period} (${result.model})`);
  }
  if(base){after=ledgerIdentity(await request('/api/state'));assert.equal(after.sha256,before.sha256,'Analytics changed the ledger');}
  const out=flag('--out')||'data/verification/ai/latest.json';mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify({at:new Date().toISOString(),base:base||'direct Gemini API',rows,ledger_before:before?.sha256,ledger_after:after?.sha256,pass:true},null,2),{mode:0o600});
  console.log(`PASS: real model intents${base?'; unchanged ledger':''}. Private proof: ${out}`);
}catch(error){console.error(error.message);process.exitCode=1;}
