import { mkdirSync,writeFileSync } from 'node:fs';
import { openDb,nowIso } from '../src/db.mjs';
import { createPayPal } from '../src/paypal.mjs';
import { seed } from './seed.mjs';
import { callTool,assertLedger } from '../src/metering.mjs';
import { createTopup,captureTopup,processWebhook,payOut,reconcile } from '../src/payments.mjs';

try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
const mock=process.argv.includes('--mock');
const value=flag=>{const i=process.argv.indexOf(flag);return i<0?null:process.argv[i+1];};
const env=mock?{PAYPAL_MODE:'mock'}:process.env;
const db=openDb(':memory:');const paypal=createPayPal(env,{db});
if(!mock&&paypal.mode!=='live')throw new Error('Configure sandbox credentials, or use --mock for clearly labelled simulations');
const results=[];const evidence={mode:mock?'mock':'sandbox',at:nowIso(),checks:results};
const record=(check,result,notes,details)=>{results.push({check,result,notes,...(details?{details}:{})});};
async function check(name,fn){try{await fn();}catch(error){record(name,'FAIL',error.message,{http_status:error.status});}}
let orderId=value('--order-id');let captured;
try {
  if(mock){
    await seed(db,paypal);
    await check('V1',async()=>{const order=await createTopup(db,paypal,'consumer_demo',1_000_000,'verify-funds');await paypal.approveOrder(order.order_id);captured=await captureTopup(db,paypal,'consumer_demo',order.id);if(captured.status!=='CAPTURED'||!Number.isSafeInteger(captured.fee_micro))throw new Error('Capture or fee missing');record('V1','PASS','SIMULATED create, approval, capture, fee visibility; gross/fee/net checked',JSON.parse(captured.raw));});
    record('V2','MANUAL','Browser test required. Mock approval is not proof of PayPal SDK v6 checkout.');
    await check('V3',async()=>{const event=paypal.synthesiseCaptureEvent(captured.paypal_capture_id,captured.paypal_order_id);const before=db.prepare("SELECT balance_micro FROM accounts WHERE id='consumer_demo'").get().balance_micro;await processWebhook(db,paypal,event,{verified:true});const duplicate=await processWebhook(db,paypal,event,{verified:true});if(!duplicate.duplicate||db.prepare("SELECT balance_micro FROM accounts WHERE id='consumer_demo'").get().balance_micro!==before)throw new Error('Duplicate event changed balance');record('V3','PASS','SIMULATED verified-event replay only; real signature verification remains unproven');});
    await check('V4',async()=>{for(let i=0;i<3;i++)callTool(db,{accountId:'consumer_demo',toolName:'extract_entities',args:{text:'verify'},idempotencyKey:'verify-'+i});const payout=await payOut(db,paypal,'provider_demo');if(payout.status!=='SUCCESS'||payout.amount_micro!==30_000)throw new Error('Payout did not settle $0.03');record('V4','PASS','SIMULATED $0.03 payout success and ledger debit',JSON.parse(payout.raw));});
    await check('V5',async()=>{const report=await reconcile(db,paypal);if(report.rows.some(r=>r.status!=='MATCH'))throw new Error('Reconciliation mismatch');record('V5','PASS','SIMULATED gross, fee, net and payout reporting match',report);});
    record('V6','SKIP','AgentMeter exposes its own MCP tools. PayPal Agent Toolkit is not used; REST APIs are the integration path.');
    record('V7','MANUAL','PayPal account-reset UI must be checked separately. Local reset is available with an explicit --confirm flag.');
    assertLedger(db);
  }else{
    await check('V1',async()=>{
      if(!orderId){const order=await paypal.createOrder({amountMicro:1_000_000,reference:'verification-'+Date.now(),description:'AgentMeter sandbox verification'});orderId=order.id;record('V1','PENDING','Buyer approval required. Re-run with --order-id after approving this sandbox order.',{order_id:order.id,approve_url:order.links?.find(l=>l.rel==='approve'||l.rel==='payer-action')?.href});return;}
      let order=await paypal.approveOrder(orderId);if(order.status!=='COMPLETED')order=await paypal.captureOrder(orderId);
      const capture=order.purchase_units?.[0]?.payments?.captures?.[0];
      if(order.status!=='COMPLETED'||capture?.status!=='COMPLETED'||!capture.seller_receivable_breakdown?.paypal_fee)throw new Error('Completed capture with fee required');
      captured=order;record('V1','PASS','PayPal sandbox completed capture with explicit fee',order);
    });
    record('V2','MANUAL','Complete PayPal SDK v6 checkout in the browser; record screenshot and server capture receipt.');
    record('V3','MANUAL','Requires a public HTTPS listener, configured webhook id, and a delivered event passing signature verification.');
    await check('V4',async()=>{
      if(!process.argv.includes('--payout')||!env.PAYPAL_SANDBOX_RECIPIENT){record('V4','PENDING','Set PAYPAL_SANDBOX_RECIPIENT and pass --payout to send $0.03 of sandbox funds.');return;}
      const id='verify-'+Date.now();let batch=await paypal.createPayout({senderBatchId:id,emailSubject:'AgentMeter sandbox verification',items:[{recipient_type:'EMAIL',amount:{currency:'USD',value:'0.03'},receiver:env.PAYPAL_SANDBOX_RECIPIENT,sender_item_id:id}]});
      for(let i=0;i<5&&!batch.items?.length;i++){await new Promise(r=>setTimeout(r,1500));batch=await paypal.getPayout(batch.batch_header.payout_batch_id);}
      const success=batch.batch_header?.batch_status==='SUCCESS'&&batch.items?.every(item=>item.transaction_status==='SUCCESS');record('V4',success?'PASS':'PENDING','PayPal sandbox batch and item status',batch);
    });
    await check('V5',async()=>{const end=new Date();const report=await paypal.listTransactions({startDate:new Date(end.getTime()-30*86400000).toISOString(),endDate:end.toISOString()});const captureId=captured?.purchase_units?.[0]?.payments?.captures?.[0]?.id;const row=report.transaction_details?.find(t=>t.transaction_info?.transaction_id===captureId);record('V5',row?'PASS':'PENDING',row?'Captured order is visible in Transaction Search':'Capture not yet visible or no captured order supplied; reporting can lag.',row||report);});
    record('V6','SKIP','REST integration selected. No PayPal Agent Toolkit usage is claimed.');
    record('V7','MANUAL','Inspect account reset controls in the PayPal Developer dashboard; do not erase sandbox test records automatically.');
  }
  console.log(`\n${mock?'MOCK VERIFICATION — PASS means simulation only':'PAYPAL SANDBOX VERIFICATION — real test API calls'}\n`);
  console.log('| Check | Result | Evidence / next action |\n| --- | --- | --- |');
  for(const row of results)console.log(`| ${row.check} | ${row.result} | ${row.notes.replaceAll('|','/')} |`);
  const dir=`data/verification/${mock?'mock':'sandbox'}`;mkdirSync(dir,{recursive:true});
  const path=`${dir}/latest.json`;writeFileSync(path,JSON.stringify(evidence,null,2),{mode:0o600});console.log(`\nEvidence: ${path}`);
  for(const row of results)if(row.details?.approve_url)console.log(`Sandbox approval URL: ${row.details.approve_url}\nOrder ID: ${row.details.order_id}`);
  if(results.some(row=>row.result==='FAIL'))process.exitCode=1;
}finally{db.close();}
