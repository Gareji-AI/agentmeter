import { pathToFileURL } from 'node:url';
import { openDb,newApiKey,nowIso,transaction } from '../src/db.mjs';
import { BUILTIN_TOOLS,BUILTIN_HANDLERS } from '../src/tools.mjs';
import { createPayPal,paypalConfigFromEnv } from '../src/paypal.mjs';
import { creditCapture } from '../src/payments.mjs';
import { assertLedger } from '../src/metering.mjs';

const argsFor={extract_entities:{text:'Contact demo@example.com about $5.00.'},summarize_text:{text:'Tools produce results. Every result has a receipt.',maxSentences:1},keyword_extract:{text:'Metering receipts explain metering costs.'},diff_json:{left:{plan:'free'},right:{plan:'paid'}},slugify_batch:{items:['Tool economy','Clear accounts']},validate_links:{text:'https://example.com'}};

export async function seed(db,paypal) {
  db.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  if(db.prepare("SELECT value FROM metadata WHERE key='seed_version'").get())return {seeded:false};
  const existing=db.prepare('SELECT COUNT(*) n FROM accounts').get().n;
  if(existing&&!db.prepare("SELECT id FROM accounts WHERE id='consumer_demo'").get())return {seeded:false};
  if(!existing)transaction(db,()=>{
    const today=nowIso();
    db.prepare('INSERT INTO accounts (id,kind,display_name,api_key,created_at) VALUES (?,?,?,?,?)').run('consumer_demo','consumer','Research agent',newApiKey(),today);
    db.prepare('INSERT INTO accounts (id,kind,display_name,api_key,paypal_email,created_at) VALUES (?,?,?,?,?,?)').run('provider_demo','provider','Studio Tools',newApiKey(),process.env.PAYPAL_SANDBOX_RECIPIENT||'author@example.com',today);
    for(const tool of BUILTIN_TOOLS)db.prepare('INSERT INTO tools (id,owner_account_id,name,slug,description,price_micro,input_schema,handler,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(tool.slug,'provider_demo',tool.name,tool.slug,tool.description,tool.priceMicro,JSON.stringify(tool.inputSchema),tool.handler,today);
    for(let day=30;day>=1;day--){
      const date=new Date(Date.now()-day*86400000).toISOString().slice(0,10);let spent=0;
      for(const [i,tool] of BUILTIN_TOOLS.entries()){
        const released=(day+i)%11===0;const price=tool.priceMicro;const at=`${date}T09:${String(i*5).padStart(2,'0')}:00.000Z`;
        const args=argsFor[tool.name];const result=released?null:BUILTIN_HANDLERS[tool.handler](args);
        db.prepare('INSERT INTO calls (id,account_id,tool_id,owner_account_id,price_micro,author_credit_micro,status,idempotency_key,request_args,response_preview,error,latency_ms,created_at,settled_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`seed_call_${day}_${i}`,'consumer_demo',tool.slug,'provider_demo',price,released?0:price,released?'RELEASED':'SETTLED',`seed_${day}_${i}`,JSON.stringify(args),JSON.stringify(result),released?'Synthetic historical failure; no charge':null,18+i*3,at,at);
        if(!released)spent+=price;
      }
      db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,raw,created_at,captured_at) VALUES (?,?,?,?, 'CAPTURED',?,?,?)").run(`seed_topup_${day}`,'consumer_demo',`SEED-ORDER-${day}`,spent,JSON.stringify({seed:true,note:'Synthetic history, not a PayPal transaction'}),`${date}T08:00:00.000Z`,`${date}T08:00:00.000Z`);
      db.prepare("INSERT INTO payouts (id,provider_account_id,amount_micro,status,dry_run,payload,raw,created_at,updated_at) VALUES (?,?,?,'SUCCESS',0,?,?,?,?)").run(`seed_payout_${day}`,'provider_demo',spent,JSON.stringify({seed:true}),JSON.stringify({seed:true,note:'Synthetic history, not a PayPal payout'}),`${date}T18:00:00.000Z`,`${date}T18:00:00.000Z`);
    }
  });
  if(paypal.mode==='mock') {
    let initial=db.prepare("SELECT * FROM topups WHERE id='demo_initial_funds'").get();
    if(!initial){
      const order=await paypal.createOrder({amountMicro:5_000_000,reference:'demo_initial_funds',description:'Initial simulated demo funds'});
      db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,raw,created_at) VALUES ('demo_initial_funds','consumer_demo',?,5000000,'CREATED',?,?)").run(order.id,JSON.stringify(order),nowIso());
      initial=db.prepare("SELECT * FROM topups WHERE id='demo_initial_funds'").get();
    }
    if(initial.status!=='CAPTURED'){await paypal.approveOrder(initial.paypal_order_id);creditCapture(db,initial.id,await paypal.captureOrder(initial.paypal_order_id));}
  }
  assertLedger(db);
  db.prepare("INSERT INTO metadata (key,value) VALUES ('seed_version','1')").run();
  return {seeded:true,accounts:2,tools:6,historicalCalls:180,mode:paypal.mode==='mock'?'mock':'sandbox'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
  const config=paypalConfigFromEnv();const db=openDb(process.env.DATABASE_PATH||`data/agentmeter-${config.mode==='mock'?'mock':'sandbox'}.sqlite`);
  try{console.log(JSON.stringify(await seed(db,createPayPal(process.env,{db})),null,2));}finally{db.close();}
}
