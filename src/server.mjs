import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readFile, access } from 'node:fs/promises';
import { openDb, nowIso } from './db.mjs';
import { accountForKey, callTool, setBudget, recoverReservations, assertLedger, MeteringError } from './metering.mjs';
import { createPayPal, paypalConfigFromEnv, verifyWebhookSignature } from './paypal.mjs';
import { captureTopup, createTopup, payOut, processWebhook, reconcile } from './payments.mjs';
import { toMicro } from './money.mjs';
import { handleMcp } from './mcp.mjs';
import { bodyJson, bodyText, json, validOrigin } from './http.mjs';
import { renderPage } from './views/index.mjs';

const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function snapshot(db,paypal) {
  const buyer=db.prepare("SELECT * FROM accounts WHERE kind='consumer' ORDER BY created_at LIMIT 1").get();
  const provider=db.prepare("SELECT * FROM accounts WHERE kind='provider' ORDER BY created_at LIMIT 1").get();
  return {
    mode:paypal.mode==='mock'?'mock':'sandbox',buyer,provider,
    tools:db.prepare('SELECT * FROM tools ORDER BY price_micro,name').all(),
    calls:db.prepare('SELECT c.*,t.name tool_name,t.slug FROM calls c JOIN tools t ON c.tool_id=t.id ORDER BY c.created_at DESC,c.rowid DESC LIMIT 250').all(),
    topups:db.prepare('SELECT id,account_id,paypal_order_id,paypal_capture_id,amount_micro,fee_micro,status,created_at FROM topups ORDER BY created_at DESC LIMIT 100').all(),
    payouts:db.prepare('SELECT * FROM payouts ORDER BY created_at DESC LIMIT 100').all(),
    policies:db.prepare('SELECT * FROM budget_policies WHERE active=1 ORDER BY created_at DESC').all(),
    events:db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 15').all(),
    analytics:db.prepare("SELECT t.name tool_name,substr(c.created_at,1,10) day,c.status,COUNT(*) calls,SUM(c.price_micro) spend_micro,SUM(c.author_credit_micro) author_micro FROM calls c JOIN tools t ON t.id=c.tool_id GROUP BY t.name,substr(c.created_at,1,10),c.status ORDER BY day DESC,tool_name").all(),
  };
}

export function parseBudget(db,text) {
  if(typeof text!=='string'||text.length>500)throw new MeteringError(-32602,'Enter a short monthly budget instruction');
  const values=[...text.matchAll(/\$(\d+(?:\.\d{1,6})?)(?![\d.])/g)];
  if(values.length!==1||!/month/i.test(text))throw new MeteringError(-32602,'Use one USD amount and a monthly scope, for example: Keep extract_entities under $0.50 this month');
  const tools=db.prepare('SELECT id,name,slug FROM tools').all();
  const named=tools.filter(t=>[t.name,t.slug,t.name.replaceAll('_',' ')].some(name=>text.toLowerCase().includes(name)));
  if(named.length>1)throw new MeteringError(-32602,'Set one tool budget at a time');
  if(!named.length&&!/all tools|total|overall|entire/i.test(text))throw new MeteringError(-32602,'Name a tool or say all tools');
  return {capMicro:toMicro(values[0][1]),toolId:named[0]?.id||null,sourceText:text};
}

export function createApplication({db,paypal,env=process.env,publicBaseUrl=env.PUBLIC_BASE_URL||'http://localhost:8787',render}={}) {
  const config=paypalConfigFromEnv(env);
  db ||= openDb(env.DATABASE_PATH||`data/agentmeter-${config.mode==='mock'?'mock':'sandbox'}.sqlite`);
  paypal ||= createPayPal(env,{db});
  db.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const storedMode=db.prepare("SELECT value FROM metadata WHERE key='payment_mode'").get()?.value;
  if(storedMode&&storedMode!==paypal.mode)throw new Error('This database belongs to a different payment mode. Use a separate DATABASE_PATH.');
  db.prepare("INSERT OR IGNORE INTO metadata (key,value) VALUES ('payment_mode',?)").run(paypal.mode);
  const sessions=new Map();
  const accessToken=env.DEMO_ACCESS_TOKEN||randomUUID();
  const ctx={db,paypal,publicBaseUrl,sessions,accessToken,env};
  const sessionFor=req=>{
    const sid=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('am_session='))?.slice(11);
    const session=sessions.get(sid);
    if(session&&session.expires>Date.now())return session;
    if(sid)sessions.delete(sid);
    return null;
  };
  const operator=req=>Boolean(sessionFor(req))||equal(req.headers['x-demo-token'],accessToken);
  const account=(req,kind)=>{
    if(operator(req)) {
      const row=db.prepare('SELECT * FROM accounts WHERE kind=? ORDER BY created_at LIMIT 1').get(kind);
      if(!row)throw new MeteringError(-32602,'Database not seeded');
      return row;
    }
    const row=accountForKey(db,req.headers.authorization?.replace(/^Bearer /,''));
    if(row.kind!==kind)throw new MeteringError(-32001,`${kind.toUpperCase()}_REQUIRED`);
    return row;
  };
  const establish=(res)=>{
    const sid=randomUUID();
    if(sessions.size>1000)sessions.clear();
    sessions.set(sid,{expires:Date.now()+8*3600000});
    res.setHeader('Set-Cookie',`am_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${new URL(ctx.publicBaseUrl).protocol==='https:'?'; Secure':''}`);
  };
  const server=createServer(async(req,res)=>{
    try {
      const localPort=server.address()?.port;
      const hosts=new Set([new URL(ctx.publicBaseUrl).host,`127.0.0.1:${localPort}`,`localhost:${localPort}`]);
      if(!hosts.has(req.headers.host))return json(res,403,{error:'Invalid Host'});
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
      const url=new URL(req.url,ctx.publicBaseUrl);const path=url.pathname;
      if(path==='/mcp')return await handleMcp(req,res,ctx);
      if(path==='/health')return json(res,200,{status:'ok',mode:paypal.mode==='mock'?'mock':'sandbox'});
      if(req.method==='POST'&&!validOrigin(req,ctx.publicBaseUrl))return json(res,403,{error:'Invalid Origin'});
      if(path==='/api/webhooks/paypal'&&req.method==='POST') {
        const rawBody=await bodyText(req);const event=JSON.parse(rawBody);
        const verification=await verifyWebhookSignature({config:paypal.config,headers:req.headers,rawBody});
        if(!verification.verified)return json(res,401,{error:'Webhook verification failed'});
        return json(res,200,await processWebhook(db,paypal,event,{verified:true}));
      }
      if(path.startsWith('/assets/')&&req.method==='GET') {
        const files={'/assets/app.css':['./public/app.css','text/css'],'/assets/app.js':['./public/app.js','text/javascript'],'/assets/grid.js':['./public/grid.js','text/javascript'],'/assets/studio.js':['./public/studio.js','text/javascript']};
        const file=files[path];if(!file)return json(res,404,{error:'Not found'});
        try { const content=await readFile(new URL(file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8'});return res.end(content); }catch(e){if(e.code==='ENOENT')return json(res,404,{error:'Not found'});throw e;}
      }
      if(path==='/api/session'&&req.method==='POST') {
        const input=await bodyJson(req);
        if(paypal.mode!=='mock'&&!equal(input.token,accessToken))return json(res,401,{error:'Invalid demo access token'});
        establish(res);return json(res,200,{ok:true});
      }
      if(path.startsWith('/api/')&&req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Use application/json'});
      if(path==='/api/state'&&req.method==='GET') {
        if(!operator(req))return json(res,401,{error:'Sign in to the demo'});
        assertLedger(db);return json(res,200,{...snapshot(db,paypal),payoutMode:env.PAYOUT_MODE==='dry-run'&&paypal.mode!=='mock'?'dry-run':'sandbox',clientId:paypal.mode==='live'?paypal.config.clientId:null});
      }
      if(path==='/api/call'&&req.method==='POST') {
        const buyer=account(req,'consumer');const input=await bodyJson(req);
        return json(res,200,callTool(db,{accountId:buyer.id,toolName:input.name,args:input.arguments||{},idempotencyKey:req.headers['idempotency-key']||input.idempotency_key}));
      }
      if(path==='/api/demo'&&req.method==='POST') {
        const buyer=account(req,'consumer');await bodyJson(req);
        const run=req.headers['idempotency-key'];if(!run)throw new MeteringError(-32602,'Idempotency-Key is required');
        const results=[];
        for(let i=0;i<3;i++)results.push(callTool(db,{accountId:buyer.id,toolName:'extract_entities',args:{text:[`Contact ops@example.com about $5.00.`,`Review https://example.com on 2026-11-12.`,`Send the receipt to author@example.com.`][i]},idempotencyKey:`${run}:${i}`}));
        return json(res,200,{results,narration:'The planner selected three $0.0100 calls. Each successful result was settled exactly once.',narration_source:'deterministic planner'});
      }
      if(path==='/api/budget'&&req.method==='POST') {
        const buyer=account(req,'consumer');const input=await bodyJson(req);
        const intent=parseBudget(db,input.text);const id=setBudget(db,buyer.id,intent);
        return json(res,200,{id,intent,source:'validated rule parser'});
      }
      if(path==='/api/topup'&&req.method==='POST') {
        const buyer=account(req,'consumer');const input=await bodyJson(req);
        return json(res,200,await createTopup(db,paypal,buyer.id,toMicro(input.amount),req.headers['idempotency-key']));
      }
      const captureMatch=path.match(/^\/api\/topup\/([^/]+)\/capture$/);
      if(captureMatch&&req.method==='POST')return json(res,200,await captureTopup(db,paypal,account(req,'consumer').id,captureMatch[1]));
      if(path==='/api/mock/approve'&&req.method==='POST') {
        if(paypal.mode!=='mock')return json(res,404,{error:'Not found'});
        const buyer=account(req,'consumer');const input=await bodyJson(req);
        const topup=db.prepare('SELECT * FROM topups WHERE id=? AND account_id=?').get(input.topup_id,buyer.id);
        if(!topup)throw new MeteringError(-32602,'Unknown top-up');
        await paypal.approveOrder(topup.paypal_order_id);
        return json(res,200,await captureTopup(db,paypal,buyer.id,topup.id));
      }
      if(path==='/api/payout'&&req.method==='POST') {
        const provider=account(req,'provider');await bodyJson(req);
        return json(res,200,await payOut(db,paypal,provider.id,{dryRun:env.PAYOUT_MODE==='dry-run'&&paypal.mode!=='mock'}));
      }
      if(path==='/api/reconcile'&&req.method==='GET') {
        if(!operator(req))return json(res,401,{error:'Sign in to the demo'});
        return json(res,200,await reconcile(db,paypal));
      }
      if(path==='/events'&&req.method==='GET') {
        if(!operator(req))return json(res,401,{error:'Sign in to the demo'});
        const lastId=Number(req.headers['last-event-id']||url.searchParams.get('after')||0);
        let cursor=Number.isSafeInteger(lastId)&&lastId>=0?lastId:0;
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
        const send=()=>{for(const event of db.prepare('SELECT * FROM events WHERE id>? ORDER BY id LIMIT 100').all(cursor)){res.write(`id: ${event.id}\nevent: ledger\ndata: ${JSON.stringify(event)}\n\n`);cursor=event.id;}};
        res.write('retry: 1500\n\n');send();
        const interval=setInterval(()=>{if(res.writableLength>1_000_000)return res.end();send();res.write(': heartbeat\n\n');},1000);
        interval.unref();res.on('close',()=>clearInterval(interval));return;
      }
      if(req.method==='GET'&&['/','/app','/provider','/reconcile','/grid','/paypal/return'].includes(path)||req.method==='GET'&&path.startsWith('/mock/checkout/')) {
        let authenticated=operator(req);
        if(!authenticated&&paypal.mode==='mock'){establish(res);authenticated=true;}
        const data=authenticated?snapshot(db,paypal):{};
        const rendering=render||renderPage;
        const html=await rendering(path,{...data,authenticated,report:authenticated&&path==='/reconcile'?await reconcile(db,paypal):null,mode:paypal.mode==='mock'?'mock':'sandbox',payoutMode:env.PAYOUT_MODE||'sandbox',clientId:paypal.mode==='live'?paypal.config.clientId:null,query:Object.fromEntries(url.searchParams),studioLicense:env.AG_STUDIO_LICENSE_KEY||'',gridLicense:env.AG_GRID_LICENSE_KEY||'',geminiConfigured:Boolean(env.GEMINI_API_KEY)});
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);
      }
      return json(res,404,{error:'Not found'});
    } catch(error) {
      if(res.headersSent)return res.end();
      const status=error instanceof SyntaxError?400:error.code===-32001?401:error instanceof MeteringError?400:error.status===413?413:502;
      return json(res,status,{error:error instanceof MeteringError?error.message:error instanceof SyntaxError?'Invalid JSON':'Request failed',code:error.code,data:error.data});
    }
  });
  return {server,ctx,db,paypal};
}

export async function start() {
  try { process.loadEnvFile(); }catch(e){if(e.code!=='ENOENT')throw e;}
  const app=createApplication();
  recoverReservations(app.db);
  // The seed module is added at the dedicated seed checkpoint.
  try { await access(new URL('../scripts/seed.mjs',import.meta.url));const {seed}=await import('../scripts/seed.mjs');await seed(app.db,app.paypal); }catch(e){if(e.code!=='ENOENT')throw e;}
  assertLedger(app.db);
  const port=Number(process.env.PORT||8787);const host=process.env.HOST||'127.0.0.1';
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,host,resolve);});
  console.log(`AgentMeter: http://${host}:${app.server.address().port} (${app.paypal.mode==='mock'?'MOCK — simulated funds':'PAYPAL SANDBOX — test funds'})`);
  if(app.paypal.mode!=='mock')console.log(`Demo access token: ${app.ctx.accessToken}`);
  let closing=false;
  const close=()=>{if(closing)return;closing=true;app.server.closeAllConnections();app.server.close(()=>app.db.close());};
  process.once('SIGINT',close);process.once('SIGTERM',close);
  return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)start().catch(e=>{console.error(e.message);process.exitCode=1;});
