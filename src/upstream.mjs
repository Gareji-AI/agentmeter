import { randomUUID } from 'node:crypto';
import { upstreamJson } from './upstream-http.mjs';
export async function invokeUpstream(config,args,{allowLoopback=false,base,timeout=10000}={}) {
  const signal=AbortSignal.timeout(timeout),headers={};
  if(config.secret)headers[config.auth_mode==='x-api-key'?'X-API-Key':'Authorization']=config.auth_mode==='x-api-key'?config.secret:'Bearer '+config.secret;
  const requestId=config.requestId||randomUUID();
  if(config.kind==='http')headers['Idempotency-Key']=requestId;
  const request=(body,options={})=>upstreamJson(config.endpoint,body,{signal,headers,allowLoopback,base,...options});
  let result;
  if(config.kind==='http')result=(await request(args)).json;
  else {
    const initId=randomUUID();const initialized=await request({jsonrpc:'2.0',id:initId,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'AgentMeter gateway',version:'1.0.0'}}},{rpcId:initId});
    const version=initialized.json.result.protocolVersion;if(!['2025-11-25','2025-06-18','2025-03-26'].includes(version))throw Error('Unsupported upstream MCP protocol');
    headers['MCP-Protocol-Version']=version;if(initialized.session)headers['MCP-Session-Id']=initialized.session;
    try {
    await request({jsonrpc:'2.0',method:'notifications/initialized'},{notification:true});
    const listId=randomUUID(),listing=(await request({jsonrpc:'2.0',id:listId,method:'tools/list'},{rpcId:listId})).json.result;
    if(!Array.isArray(listing.tools)||!listing.tools.some(t=>t.name===config.remote_tool))throw Error('The registered MCP tool is not listed upstream');
    const callId=randomUUID(),called=(await request({jsonrpc:'2.0',id:callId,method:'tools/call',params:{name:config.remote_tool,arguments:args}},{rpcId:callId,headers:{...headers,'Idempotency-Key':requestId}})).json.result;
    if(called.isError)throw Error('The upstream MCP tool reported an error');
    if(called.structuredContent&&typeof called.structuredContent==='object'&&!Array.isArray(called.structuredContent))result=called.structuredContent;
    else if(Array.isArray(called.content)&&called.content.length&&called.content.every(c=>c.type==='text'&&typeof c.text==='string'))result={content:called.content};
    else throw Error('Use an MCP tool returning text or structured JSON');
    } finally {
      // DELETE is optional for servers; never turn a successful tool result into a charge failure.
      if(headers['MCP-Session-Id'])await request(undefined,{method:'DELETE',notification:true,signal:AbortSignal.timeout(1500)}).catch(()=>{});
    }
  }
  if(result===null||typeof result!=='object')throw Error('Upstream must return a JSON object or array');
  if(config.secret&&JSON.stringify(result).includes(config.secret))throw Error('Upstream response included authentication material');
  return Array.isArray(result)?{data:result}:result;
}
