import { workspaceSession } from './workspaces.mjs';
import { providerFor,requireProvider,createProvider,updateProvider,registerProviderTool,toolForOwner,changeToolPrice,setToolPublished,replaceToolCredential,providerSnapshot } from './providers.mjs';
import { MeteringError } from './metering.mjs';
import { bodyJson,json } from './http.mjs';
import { payOut } from './payments.mjs';
import { renderSeller } from './views/seller.mjs';
export async function handleProvider(req,res,ctx) {
  const path=new URL(req.url,ctx.publicBaseUrl).pathname;
  if(path!=='/sell'&&!path.startsWith('/api/customer/provider/'))return false;
  const {db,paypal,gateway,env}=ctx,workspaceId=workspaceSession(db,req.headers.cookie);
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(!workspaceId){if(req.method==='GET'&&path==='/sell'){res.writeHead(303,{Location:'/sign-in'});res.end();return true;}throw new MeteringError(-32001,'Workspace sign-in required');}
  const snapshot=()=>providerSnapshot(db,workspaceId,ctx.publicBaseUrl);
  if(req.method==='GET'){
    if(path==='/sell'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(renderSeller(snapshot(),{mode:paypal.mode==='mock'?'mock':'sandbox',payoutMode:env.PAYOUT_MODE}));return true;}
    if(path==='/api/customer/provider/state'){json(res,200,snapshot());return true;}
  }
  if(req.method!=='POST'){json(res,404,{error:'Not found'});return true;}
  if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'Use application/json'});return true;}
  const input=await bodyJson(req,32768);
  if(path==='/api/customer/provider/profile'){
    if(providerFor(db,workspaceId)){updateProvider(db,workspaceId,input);json(res,200,{ok:true});}
    else {json(res,201,createProvider(db,workspaceId,input));}return true;
  }
  const provider=requireProvider(db,workspaceId);
  if(path==='/api/customer/provider/tools') {json(res,201,registerProviderTool(db,provider.id,input,{key:gateway.key,base:ctx.publicBaseUrl,allowLoopback:paypal.mode==='mock'&&env.TEST_UPSTREAM_LOOPBACK==='1'}));return true;}
  if(path==='/api/customer/provider/payouts') {
    const payout=await payOut(db,paypal,provider.id,{dryRun:env.PAYOUT_MODE==='dry-run'&&paypal.mode!=='mock'});
    json(res,200,{id:payout.id,status:payout.status,amount_micro:payout.amount_micro,paypal_batch_id:payout.paypal_batch_id});return true;
  }
  const action=path.match(/^\/api\/customer\/provider\/tools\/([^/]+)\/(test|price|publish|credentials)$/);
  if(action){
    const tool=toolForOwner(db,provider.id,action[1]);
    if(action[2]==='price')changeToolPrice(db,provider.id,tool.id,input.price_usd);
    else if(action[2]==='publish')setToolPublished(db,provider.id,tool.id,input.published);
    else if(action[2]==='credentials')replaceToolCredential(db,provider.id,tool.id,input,gateway.key);
    else {
      // Per-provider probe quota; no buyer funds are reserved by a connection test.
      ctx.probeLimits??=new Map();const now=Date.now();let bucket=ctx.probeLimits.get(provider.id);
      if(!bucket||bucket.until<now){bucket={until:now+600000,count:0};ctx.probeLimits.set(provider.id,bucket);}
      if(++bucket.count>10)throw new MeteringError(-32005,'Too many connection tests. Try again later.');
      const result=await gateway.probe(tool,input.arguments||{});json(res,200,{ok:true,result});return true;
    }
    json(res,200,{ok:true});return true;
  }
  json(res,404,{error:'Not found'});return true;
}
