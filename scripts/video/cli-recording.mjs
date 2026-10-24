// Film the installed Codex CLI's real text output, not a reconstructed chat UI.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir,homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { boundedCall,invoices,safeResult } from './live-codex.mjs';

export function captureLineSink(emit, privateValues) {
  let partial='';
  const redact=text=>privateValues.filter(v=>typeof v==='string'&&v.length).reduce((s,key)=>s.replaceAll(key,'[private]'),text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g,''));
  return {
    write(chunk){partial+=chunk;const lines=partial.split('\n');partial=lines.pop();for(const line of lines)emit(redact(line)+'\n');},
    end(){if(partial){emit(redact(partial));partial='';}}
  };
}

export async function startCliRecording(directory) {
  try { process.loadEnvFile(); } catch(e) { if(e.code!=='ENOENT')throw e; }
  const privateInput=JSON.parse(readFileSync(join(directory,'client-private.json')));
  const provider=JSON.parse(readFileSync(join(directory,'provider-private.json')));
  const {base:remoteBase,client_key,tool}=privateInput;
  assert.equal(remoteBase,'https://agentmeter-sandbox.onrender.com');
  assert.ok(client_key&&tool&&provider.cookie&&process.env.DEMO_ACCESS_TOKEN);
  const nonceFile=join(directory,'cli-execution-private.json');
  let saved;
  try { saved=JSON.parse(readFileSync(nonceFile)); } catch(e) { if(e.code!=='ENOENT')throw e; saved={nonces:invoices.map(()=>randomUUID()),started:false}; }
  assert.equal(saved.started,false,'This take already ran; inspect its receipts, never silently repeat');
  const token=randomUUID();
  writeFileSync(nonceFile,JSON.stringify(saved),{mode:0o600});
  const state={phase:'Ready',started:false,exit_code:null,verified:false,model:'gpt-6.1-sol',tool,
    transcript:'',before:null,current:null,calls:[],attempts:0,source:'Installed official Codex CLI exec; real stdout/stderr; secrets redacted; no generated transcript'};
  const clients=new Set();
  const privateValues=[client_key,provider.cookie,process.env.DEMO_ACCESS_TOKEN,token,homedir()];
  const publish=()=>{const data=JSON.stringify(state);for(const secret of [client_key,provider.cookie,process.env.DEMO_ACCESS_TOKEN,token])assert.ok(!data.includes(secret));writeFileSync(join(directory,'cli-public-proof.json'),data,{mode:0o600});for(const c of clients)c.write(`data: ${data}\n\n`);};
  const readLedger=async()=>{
    const get=async(path,headers)=>{const r=await fetch(remoteBase+path,{headers,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();};
    const [s,p]=await Promise.all([get('/api/state',{'x-demo-token':process.env.DEMO_ACCESS_TOKEN}),get('/api/customer/provider/state',{Cookie:provider.cookie})]);
    assert.equal(s.mode,'sandbox');const registered=p.tools.find(t=>t.name===tool);assert.equal(registered.price_micro,10000);assert.ok(registered.enabled);
    return {buyer_micro:s.buyer.balance_micro,provider_micro:p.provider.balance_micro,receipt_ids:p.calls.filter(c=>c.status==='SETTLED').map(c=>c.id)};
  };
  state.before=state.current=await readLedger();
  assert.equal(state.before.provider_micro,0,'Use a new zero-earning provider for the single-flow take');
  const remote=async message=>{const r=await fetch(remoteBase+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+client_key},body:JSON.stringify(message),signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();};
  const listed=await remote({jsonrpc:'2.0',id:1,method:'tools/list'}),spec=listed.result.tools.find(t=>t.name===tool);assert.ok(spec);
  const prompt=`Use AgentMeter's registered invoice tool ${tool} to review these three synthetic invoices. Call the tool once per invoice, sequentially. The total tool budget is $0.03. Return a compact table of invoice totals and due dates, plus the total tool charge. Do not approve or pay the invoices.\n\n${invoices.join('\n')}`;
  writeFileSync(join(directory,'public-prompt.txt'),prompt+'\n');
  let base,child;
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const server=createServer(async(req,res)=>{
    try {
      if(req.headers.host!==new URL(base).host)return send(res,403,{error:'Invalid Host'});
      res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Content-Type-Options','nosniff');
      const path=new URL(req.url,base).pathname;
      if(path==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(readFileSync(new URL('./cli-recording.html',import.meta.url)));}
      if(path==='/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});clients.add(res);res.write(`data: ${JSON.stringify(state)}\n\n`);req.on('close',()=>clients.delete(res));return;}
      let body='';for await(const part of req){body+=part;if(body.length>20000)throw Error('Input too large');}
      if(path==='/run'&&req.method==='POST'){
        if(req.headers.origin!==base||req.headers['content-type']!=='application/json')return send(res,403,{error:'Invalid Origin'});
        if(state.started)return send(res,409,{error:'One run per take'});
        const request=JSON.parse(body);assert.equal(request.prompt,prompt,'Use the exact synthetic filming prompt');
        saved.started=true;writeFileSync(nonceFile,JSON.stringify(saved),{mode:0o600});state.started=true;state.phase='Codex running';publish();
        const cwd=mkdtempSync(join(tmpdir(),'AgentMeter-invoice-demo-'));
        const settings=[`mcp_servers={agentmeter={url=${JSON.stringify(base+'/mcp')},bearer_token_env_var="AGENTMETER_CAPTURE_TOKEN"}}`,'features.apps=false','features.plugins=false','features.remote_plugin=false','features.multi_agent=false','features.shell_tool=false','features.shell_snapshot=false','features.skill_search=false','features.skip_host_skill_discovery=true','web_search="disabled"','project_doc_max_bytes=0','model_reasoning_effort="low"','model_reasoning_summary="none"'];
        const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));env.AGENTMETER_CAPTURE_TOKEN=token;
        const args=['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--color','never','-C',cwd,'-m',state.model,'-c','approval_policy="never"',...settings.flatMap(v=>['-c',v]),'-'];
        child=spawn(process.env.CODEX_BIN||'codex',args,{cwd,env,stdio:['pipe','pipe','pipe']});
        // Complete lines avoid rendering fragments of credentials before redaction.
        for(const stream of [child.stdout,child.stderr]){const sink=captureLineSink(line=>{state.transcript+=line;publish();},privateValues);stream.setEncoding('utf8');stream.on('data',part=>sink.write(part));stream.on('end',()=>sink.end());}
        child.on('error',()=>{state.phase='CLI unavailable';publish();});
        child.on('close',async code=>{state.exit_code=code;try{state.current=await readLedger();const paid=state.calls.filter(c=>!c.receipt.reused);assert.equal(code,0);assert.equal(paid.length,3);assert.equal(new Set(paid.map(c=>c.receipt.call_id)).size,3);assert.equal(state.before.buyer_micro-state.current.buyer_micro,30000);assert.equal(state.current.provider_micro-state.before.provider_micro,30000);for(const c of paid)assert.ok(state.current.receipt_ids.includes(c.receipt.call_id));state.verified=true;state.phase='Complete · three hosted receipts verified';}catch{state.phase='Inspect this take before retrying';}publish();});
        child.stdin.end(prompt+'\n');return send(res,202,{started:true});
      }
      if(path!=='/mcp'||req.method!=='POST'||req.headers.authorization!=='Bearer '+token)return send(res,404,{error:'Not found'});
      const m=JSON.parse(body),wrap=result=>send(res,200,{jsonrpc:'2.0',id:m.id,result});
      if(m.id===undefined){res.writeHead(202);return res.end();}
      if(m.method==='initialize')return wrap({protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'AgentMeter bounded recording gateway',version:'1.0.0'},instructions:'Use the invoice tool with the exact synthetic text supplied. The gateway supplies stable execution IDs and price caps. Maximum three distinct invoices.'});
      if(m.method==='ping')return wrap({});
      if(m.method==='tools/list')return wrap({tools:[{...spec,description:'Extract totals and due dates from synthetic invoice text for human review. Price $0.01 per successful call. Send only the text field; the recording gateway binds execution IDs and a one-cent maximum quote.',inputSchema:{type:'object',properties:{text:{type:'string',enum:invoices}},required:['text'],additionalProperties:false}}]});
      assert.ok(state.started&&m.method==='tools/call');
      let params;try{params=boundedCall(tool,saved.nonces,m.params);}catch{return send(res,200,{jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Use the approved tool and exact synthetic invoice text only; send the text field.'}});}
      state.attempts++;publish();const response=await remote({...m,params});
      if(response.result){state.calls.push(safeResult(response.result));state.current=await readLedger();publish();}
      return send(res,200,{...response,id:m.id});
    }catch{send(res,500,{error:'Recording request stopped; inspect private evidence before retrying'});}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;publish();
  writeFileSync(join(directory,'cli-location.json'),JSON.stringify({base}),{mode:0o600});
  console.log('Official CLI recording ready: '+base+' (maximum $0.03 sandbox credit).');
  const stop=()=>{child?.kill('SIGTERM');for(const c of clients)c.end();server.closeAllConnections();server.close();};process.once('SIGINT',stop);process.once('SIGTERM',stop);return {base,state,stop};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startCliRecording(process.argv[2]).catch(()=>{console.error('CLI recording setup failed before any execution.');process.exit(1);});
