// Exercise actual Codex MCP transport, without a model turn or persistent chat.
// Input is a private JSON file: {base,client_key,tools:[{name,arguments},...]}
import { readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.argv[2])throw Error('Pass a private JSON credential/selected-tool file. This command spends sandbox/mock tool credit.');
const creds=JSON.parse(readFileSync(process.argv[2]));
if(!Array.isArray(creds.tools)||creds.tools.length!==3||creds.tools.some(t=>!Number.isSafeInteger(t.arguments?._max_price_micro)||t.arguments._max_price_micro!==10000))throw Error('Select exactly three $0.01 tool calls explicitly in the private input file');
const overrides=['-c',`mcp_servers={agentmeter_verification={url=${JSON.stringify(new URL('/mcp',creds.base).href)},bearer_token_env_var="AGENTMETER_BUYER_KEY"}}`];
const cwd=mkdtempSync(join(tmpdir(),'agentmeter-provider-codex-'));
const child=spawn(process.env.CODEX_BIN||'codex',['app-server',...overrides],{cwd,env:{...process.env,AGENTMETER_BUYER_KEY:creds.client_key},stdio:['pipe','pipe','pipe']});
let sequence=0;const pending=new Map();let errors='';child.stderr.on('data',x=>{errors=(errors+x).slice(-2000);});
const rejectPending=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Codex app-server stopped'));}pending.clear();};child.on('exit',rejectPending);child.on('error',rejectPending);
createInterface({input:child.stdout}).on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const request=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Codex '+method+' timed out'));},45000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
const out=process.argv[3]||'data/verification/providers/codex-latest.json';
const proof={at:new Date().toISOString(),base:creds.base,client:'Installed Codex app-server; ephemeral thread; direct MCP calls; no model turn',calls:[],pass:false};
const save=()=>{const serialized=JSON.stringify(proof,null,2);if(serialized.includes(creds.client_key))throw Error('Refusing to write credential to proof');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,serialized,{mode:0o600});};
try {
 await request('initialize',{clientInfo:{name:'agentmeter_provider_verification',version:'1.0.0'},capabilities:{experimentalApi:true}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
 const thread=await request('thread/start',{cwd,ephemeral:true});
 const discovery=await request('mcpServerStatus/list',{serverName:'agentmeter_verification',detail:'toolsAndAuthOnly'});proof.discovery=discovery;
 const threadId=thread.thread.id;
 for(const selected of creds.tools){
   // Save the nonce before sending. Ambiguous interruptions can be resumed with the same nonce.
   selected.arguments._request_id ||= randomUUID();writeFileSync(process.argv[2],JSON.stringify(creds,null,2),{mode:0o600});
   const result=await request('mcpServer/tool/call',{threadId,server:'agentmeter_verification',tool:selected.name,arguments:selected.arguments});
   const content=result.content?.find(c=>c.type==='text')?.text;let output;try{output=JSON.parse(content);}catch{throw Error('Codex returned no JSON tool receipt: '+JSON.stringify(result));}
   const receipt=output._agentmeter_receipt;assert.equal(result.isError,false);assert.equal(receipt.status,'SETTLED');assert.equal(receipt.price_micro,10000);
   proof.calls.push({name:selected.name,request_id:selected.arguments._request_id,output});save();
 }
 const retry=creds.tools[0],replayed=await request('mcpServer/tool/call',{threadId,server:'agentmeter_verification',tool:retry.name,arguments:retry.arguments});
 const receipt=JSON.parse(replayed.content.find(c=>c.type==='text').text)._agentmeter_receipt;
 assert.equal(receipt.reused,true);assert.equal(receipt.charged_this_request_micro,0);proof.retry=receipt;proof.pass=true;save();
 console.log(JSON.stringify({pass:true,client:proof.client,calls:proof.calls.map(c=>({tool:c.name,receipt:c.output._agentmeter_receipt})),replay_charged_micro:receipt.charged_this_request_micro}));
}catch(error){save();console.error((error.message+' '+errors).replaceAll(creds.client_key,'[private]'));process.exitCode=1;}
finally{for(const p of pending.values())clearTimeout(p.timer);child.kill('SIGTERM');rmSync(cwd,{recursive:true,force:true});}
