import { accountForKey, callTool, MeteringError } from './metering.mjs';
import { bodyJson, json, validOrigin } from './http.mjs';

export const PROTOCOL_VERSIONS = ['2025-11-25','2025-06-18','2025-03-26'];
export async function handleMcp(req,res,{db,publicBaseUrl='http://localhost:8787'}) {
  const error=(status,id,code,message,data)=>json(res,status,{jsonrpc:'2.0',id,error:{code,message,...(data?{data}:{})}});
  if(!validOrigin(req,publicBaseUrl)) return error(403,null,-32001,'INVALID_ORIGIN');
  let account;
  try { account=accountForKey(db,req.headers.authorization?.replace(/^Bearer /,'')); }
  catch(e) { return error(401,null,-32001,'UNAUTHORIZED'); }
  if(account.kind!=='consumer') return error(403,null,-32001,'CONSUMER_REQUIRED');
  if(req.method!=='POST') { res.setHeader('Allow','POST');return error(405,null,-32600,'This stateless MCP endpoint supports POST only'); }
  if(!req.headers['content-type']?.startsWith('application/json')) return error(415,null,-32600,'Content-Type must be application/json');
  const accept=req.headers.accept||'';
  if(!accept.includes('application/json')||!accept.includes('text/event-stream')) return error(406,null,-32600,'Accept must include application/json and text/event-stream');
  if(req.headers['mcp-protocol-version']&&!PROTOCOL_VERSIONS.includes(req.headers['mcp-protocol-version'])) return error(400,null,-32600,'Unsupported MCP protocol version');
  let message;
  try { message=await bodyJson(req); } catch(e) { return error(e.status||400,null,-32700,e.status?'Request body too large':'Parse error'); }
  if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||(message.id!==undefined&&typeof message.id!=='string'&&!Number.isSafeInteger(message.id))) return error(400,null,-32600,'Invalid Request');
  if(message.id===undefined) {
    if(!message.method.startsWith('notifications/')) return error(400,null,-32600,'Requests require an id');
    res.writeHead(202);return res.end();
  }
  try {
    let result;
    switch(message.method) {
      case 'initialize': result={protocolVersion:PROTOCOL_VERSIONS.includes(message.params?.protocolVersion)?message.params.protocolVersion:PROTOCOL_VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'AgentMeter',version:'0.1.0'},instructions:'Metered sandbox tools. Set a unique Idempotency-Key for each intended call; reuse it only for retries.'};break;
      case 'ping': result={};break;
      case 'tools/list': result={tools:db.prepare('SELECT * FROM tools WHERE enabled=1 ORDER BY name').all().map(tool=>({name:tool.name,description:`${tool.description} Price: ${tool.price_micro} micro-USD per successful call.`,inputSchema:JSON.parse(tool.input_schema)}))};break;
      case 'tools/call': {
        if(typeof message.params?.name!=='string') throw new MeteringError(-32602,'Tool name is required');
        const args=message.params.arguments||{};
        const idempotencyKey=req.headers['idempotency-key']||`rpc:${typeof message.id}:${message.id}`;
        const called=callTool(db,{accountId:account.id,toolName:message.params.name,args,idempotencyKey});
        result={content:[{type:'text',text:JSON.stringify(called.result)}],structuredContent:called.result,isError:false,_meta:{agentmeter:{call_id:called.call.id,status:called.call.status,price_micro:called.call.price_micro,reused:called.reused}}};break;
      }
      default: throw new MeteringError(-32601,'Method not found');
    }
    return json(res,200,{jsonrpc:'2.0',id:message.id,result});
  } catch(e) {
    if(e instanceof MeteringError) {
      const data={...e.data};
      if(data.topup_url)data.topup_url=new URL(data.topup_url,publicBaseUrl).href;
      return error(200,message.id,e.code,e.message,data);
    }
    return error(200,message.id,-32603,'Internal error');
  }
}
