import { callTool,reserve,settle,release,MeteringError } from './metering.mjs';
import { transaction,nowIso } from './db.mjs';
import { upstreamKey,openSecret } from './upstream-secrets.mjs';
import { validateRemoteArgs } from './upstream-schema.mjs';
import { invokeUpstream } from './upstream.mjs';

export function createGateway(db,{base,allowLoopback=false,invoke=invokeUpstream,timeout=10000}={}) {
  const key=upstreamKey(db);let active=0;const byBuyer=new Map();
  const execute=async(tool,args,requestId)=>{
    const secret=openSecret(key,tool.auth_cipher,tool.id+'\0'+tool.owner_account_id);
    return invoke({...tool,secret,requestId},args,{base:typeof base==='function'?base():base,allowLoopback,timeout});
  };
  return {key,
    async probe(tool,args){
      validateRemoteArgs(JSON.parse(tool.input_schema),args);const revision=tool.revision;
      try{const result=await execute(tool,args,'probe_'+crypto.randomUUID());db.prepare('UPDATE tool_upstreams SET tested_at=?,last_error=NULL WHERE tool_id=? AND revision=?').run(nowIso(),tool.id,revision);return result;}
      catch(error){db.prepare('UPDATE tool_upstreams SET last_error=? WHERE tool_id=? AND revision=?').run('Connection test failed: '+error.message,tool.id,revision);throw new MeteringError(-32006,'Connection test failed',{detail:error.message});}
    },
    async call(options){
      const tool=db.prepare('SELECT * FROM tools WHERE name=? OR slug=?').get(options.toolName,options.toolName);
      if(tool?.handler!=='remote')return callTool(db,options);
      validateRemoteArgs(JSON.parse(tool.input_schema),options.args||{});
      if(!Number.isSafeInteger(options.maxPriceMicro)||options.maxPriceMicro<0)throw new MeteringError(-32602,'Set _max_price_micro to the listed price before calling a registered tool');
      if(active>=12||(byBuyer.get(options.accountId)||0)>=2)throw new MeteringError(-32005,'UPSTREAM_BUSY');
      const {reservation,upstream}=transaction(db,()=>({reservation:reserve(db,options),upstream:db.prepare('SELECT * FROM tool_upstreams WHERE tool_id=?').get(tool.id)}));
      if(reservation.reused){
        if(reservation.call.status==='RESERVED')throw new MeteringError(-32005,'CALL_IN_PROGRESS');
        if(reservation.call.status==='RELEASED')throw new MeteringError(-32006,'CALL_RELEASED');
        return {call:reservation.call,result:JSON.parse(reservation.call.response_preview),reused:true};
      }
      active++;byBuyer.set(options.accountId,(byBuyer.get(options.accountId)||0)+1);const started=performance.now();
      try{
        if(!upstream)throw Error('Upstream configuration unavailable');
        const result=await execute({...reservation.tool,...upstream},options.args||{},reservation.call.id);
        return {call:settle(db,reservation.call.id,result,performance.now()-started),result,reused:false};
      }catch(error){release(db,reservation.call.id,'Upstream execution failed');throw new MeteringError(-32006,'UPSTREAM_FAILED',{detail:error.message});}
      finally{active--;byBuyer.set(options.accountId,Math.max(0,(byBuyer.get(options.accountId)||1)-1));}
    }
  };
}
