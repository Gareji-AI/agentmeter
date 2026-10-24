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
      case 'initialize': result={protocolVersion:PROTOCOL_VERSIONS.includes(message.params?.protocolVersion)?message.params.protocolVersion:PROTOCOL_VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'AgentMeter',version:'0.1.0'},instructions:'Sandbox tool credits only. Set a unique _request_id (UUID) for each intended tool execution; reuse that value only for retries. Check the listed prices before spending.'};break;
      case 'ping': result={};break;
      case 'tools/list': result={tools:db.prepare('SELECT * FROM tools WHERE enabled=1 ORDER BY name').all().map(tool=>{const schema=JSON.parse(tool.input_schema);return {name:tool.name,description:`${tool.description} Price: ${tool.price_micro} micro-USD per successful call.`,inputSchema:account.public_customer?{...schema,properties:{...schema.properties,_request_id:{type:'string',description:'Unique UUID for this intended execution. Reuse only for retries.'}},required:[...(schema.required||[]),'_request_id']}:schema};})};break;
      case 'tools/call': {
        if(typeof message.params?.name!=='string') throw new MeteringError(-32602,'Tool name is required');
        const supplied=message.params.arguments||{};
        if(typeof supplied!=='object'||Array.isArray(supplied))throw new MeteringError(-32602,'arguments must be an object');
        const {_request_id,...args}=supplied;
        if(account.public_customer&&!req.headers['idempotency-key']&&(typeof _request_id!=='string'||!_request_id||_request_id.length>200))throw new MeteringError(-32602,'A unique _request_id is required; reuse only for retries');
        const idempotencyKey=req.headers['idempotency-key']||_request_id||`rpc:${typeof message.id}:${message.id}`;
        const called=callTool(db,{accountId:account.id,toolName:message.params.name,args,idempotencyKey});
        const balance=db.prepare('SELECT balance_micro,reserved_micro FROM accounts WHERE id=?').get(account.id);
        const receipt={call_id:called.call.id,status:called.call.status,price_micro:called.call.price_micro,charged_this_request_micro:called.reused?0:called.call.price_micro,balance_available_micro:balance.balance_micro-balance.reserved_micro,reused:called.reused};
        // Public clients see the receipt in ordinary tool content, not only transport metadata.
        const output=account.public_customer?{...called.result,_agentmeter_receipt:receipt}:called.result;
        result={content:[{type:'text',text:JSON.stringify(output)}],structuredContent:output,isError:false,_meta:{agentmeter:receipt}};break;
      }
      default: throw new MeteringError(-32601,'Method not found');
    }
    return json(res,200,{jsonrpc:'2.0',id:message.id,result});
  } catch(e) {
    if(e instanceof MeteringError) {
      const data={...e.data};
      if(data.topup_url)data.topup_url=new URL(account.public_customer?'/workspace#funds':data.topup_url,publicBaseUrl).href;
      return error(200,message.id,e.code,e.message,data);
    }
    return error(200,message.id,-32603,'Internal error');
  }
}
