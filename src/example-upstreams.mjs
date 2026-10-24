import { BUILTIN_HANDLERS } from './tools.mjs';
import { bodyJson,json } from './http.mjs';
export const invoiceSchema={type:'object',properties:{text:{type:'string',maxLength:4000}},required:['text'],additionalProperties:false};
export function invoiceExample(args) {
  if(typeof args?.text!=='string'||args.text.length>4000)throw Error('Use a short synthetic invoice text');
  if(args.text.includes('FAIL_UPSTREAM'))throw Error('Deliberate example failure');
  const found=BUILTIN_HANDLERS.extract_entities(args);
  return {invoice_id:args.text.match(/\b(?:INV|DEMO)[-_]\d+\b/)?.[0]||null,amounts:found.money,due_dates:found.dates,contacts:found.emails,review_required:true,source:'Public demonstration upstream; no OCR or invoice approval'};
}
export async function handleExample(req,res) {
  const path=new URL(req.url,'http://example.local').pathname;
  if(!['/examples/invoice-api','/examples/invoice-mcp'].includes(path))return false;
  if(req.method!=='POST'){json(res,405,{error:'POST JSON synthetic invoice text. This example endpoint is public and free.'});return true;}
  if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'Use application/json'});return true;}
  const input=await bodyJson(req,16384);
  if(path.endsWith('-api')){try{json(res,200,invoiceExample(input));}catch{json(res,400,{error:'Example execution failed'});}return true;}
  if(input.id===undefined){res.writeHead(202);res.end();return true;}
  let result;
  if(input.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'Public invoice example',version:'1.0.0'}};
  else if(input.method==='tools/list')result={tools:[{name:'invoice_review',description:'Prepare already-readable synthetic invoice text for human review.',inputSchema:invoiceSchema,annotations:{readOnlyHint:true}}]};
  else if(input.method==='tools/call'&&input.params?.name==='invoice_review'){
    try{const output=invoiceExample(input.params.arguments);result={content:[{type:'text',text:JSON.stringify(output)}],structuredContent:output,isError:false};}
    catch{result={content:[{type:'text',text:'Deliberate example error or invalid input'}],isError:true};}
  }else {json(res,200,{jsonrpc:'2.0',id:input.id,error:{code:-32601,message:'Method not found'}});return true;}
  json(res,200,{jsonrpc:'2.0',id:input.id,result});return true;
}
