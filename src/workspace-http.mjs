import { createWorkspace,signInWorkspace,createWorkspaceSession,workspaceSession,logoutWorkspace,issueClientKey,revokeClientKey,workspaceSnapshot } from './workspaces.mjs';
import { bodyJson,json } from './http.mjs';
import { MeteringError,setBudget } from './metering.mjs';
import { toMicro } from './money.mjs';
import { createTopup,captureTopup } from './payments.mjs';
import { renderWorkspace } from './views/workspace.mjs';
import { handleProvider } from './provider-http.mjs';

// These routes never fall through to operator-token authentication.
export async function handleWorkspace(req,res,ctx) {
  if(await handleProvider(req,res,ctx))return true;
  const {db,paypal}=ctx,url=new URL(req.url,ctx.publicBaseUrl),path=url.pathname;
  const accountId=workspaceSession(db,req.headers.cookie);
  if(req.method==='GET'&&path==='/app'&&url.searchParams.get('checkout')==='cancelled'&&accountId){res.writeHead(303,{Location:'/workspace#funds','Cache-Control':'no-store'});res.end();return true;}
  const customerReturn=path==='/paypal/return'&&accountId&&db.prepare('SELECT id FROM topups WHERE paypal_order_id=? AND account_id=?').get(url.searchParams.get('token'),accountId);
  if(!['/join','/sign-in','/workspace'].includes(path)&&!path.startsWith('/api/customer/')&&!customerReturn)return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  // Lax permits the top-level PayPal approval return; mutations still require same-origin JSON.
  const sessionCookie=(token,maxAge=604800)=>res.setHeader('Set-Cookie',`am_customer=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(ctx.publicBaseUrl).protocol==='https:'?'; Secure':''}`);
  const requireAccount=()=>{if(!accountId)throw new MeteringError(-32001,'Workspace sign-in required');return accountId;};
  const read=()=>bodyJson(req,4096);
  const amount=value=>{try{const micro=toMicro(value);if(micro<0)throw new Error();return micro;}catch{throw new MeteringError(-32602,'Enter a nonnegative USD amount with at most six decimal places');}};
  const limit=(name,who,maximum,period)=>{
    ctx.workspaceLimits??=new Map();const id=name+who,now=Date.now();
    for(const [key,value] of ctx.workspaceLimits)if(value.until<=now)ctx.workspaceLimits.delete(key);
    let bucket=ctx.workspaceLimits.get(id);if(!bucket){bucket={count:0,until:now+period};ctx.workspaceLimits.set(id,bucket);}
    if(++bucket.count>maximum){const e=new Error('Too many requests. Try again later.');e.status=429;throw e;}
  };
  if(req.method==='POST') {
    if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'Use application/json'});return true;}
    if(path==='/api/customer/workspaces') {
      limit('signup',req.socket.remoteAddress,20,600000);const input=await read();
      const workspace=createWorkspace(db,input.name);sessionCookie(createWorkspaceSession(db,workspace.id));
      json(res,201,workspace);return true;
    }
    if(path==='/api/customer/session') {
      limit('signin',req.socket.remoteAddress,60,60000);const input=await read();
      const id=signInWorkspace(db,input.recovery_code);sessionCookie(createWorkspaceSession(db,id));json(res,200,{ok:true});return true;
    }
    requireAccount();
    if(path==='/api/customer/logout') {await read();logoutWorkspace(db,req.headers.cookie);sessionCookie('',0);json(res,200,{ok:true});return true;}
    if(path==='/api/customer/keys') {limit('keys',accountId,20,600000);const input=await read();json(res,201,issueClientKey(db,accountId,input.label));return true;}
    if(path==='/api/customer/budget') {const input=await read();setBudget(db,accountId,{capMicro:amount(input.amount),sourceText:'Workspace monthly limit'});json(res,200,{ok:true});return true;}
    const revoked=path.match(/^\/api\/customer\/keys\/([^/]+)\/revoke$/);
    if(revoked){await read();revokeClientKey(db,accountId,revoked[1]);json(res,200,{ok:true});return true;}
    if(path==='/api/customer/topups') {limit('funding',accountId,10,600000);const input=await read();json(res,200,await createTopup(db,paypal,accountId,amount(input.amount),req.headers['idempotency-key']));return true;}
    const capture=path.match(/^\/api\/customer\/topups\/([^/]+)\/capture$/);
    if(capture){await read();json(res,200,await captureTopup(db,paypal,accountId,capture[1]));return true;}
    if(path==='/api/customer/mock/approve'&&paypal.mode==='mock') {
      const input=await read(),topup=db.prepare('SELECT * FROM topups WHERE id=? AND account_id=?').get(input.topup_id,accountId);
      if(!topup)throw new MeteringError(-32602,'Unknown top-up');
      await paypal.approveOrder(topup.paypal_order_id);json(res,200,await captureTopup(db,paypal,accountId,topup.id));return true;
    }
  }
  if(path==='/api/customer/state'&&req.method==='GET'){json(res,200,workspaceSnapshot(db,requireAccount(),ctx.publicBaseUrl));return true;}
  if(req.method==='GET'&&['/join','/sign-in','/workspace','/paypal/return'].includes(path)) {
    if(path==='/workspace'&&!accountId){res.writeHead(303,{Location:'/sign-in'});res.end();return true;}
    const data=accountId?workspaceSnapshot(db,accountId,ctx.publicBaseUrl):null;
    const topup=customerReturn?db.prepare('SELECT id,status FROM topups WHERE paypal_order_id=? AND account_id=?').get(url.searchParams.get('token'),accountId):null;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(renderWorkspace(path,{data,mode:paypal.mode==='mock'?'mock':'sandbox',topup}));return true;
  }
  json(res,404,{error:'Not found'});return true;
}
