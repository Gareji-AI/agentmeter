// Read-only repeat verification: never creates an order, captures or sends a payout.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPayPal } from '../src/paypal.mjs';
import { reconcile } from '../src/payments.mjs';
import { assertLedger } from '../src/metering.mjs';
try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
const path=resolve(process.env.DATABASE_PATH||'data/agentmeter-sandbox.sqlite');
const db=new DatabaseSync(path,{readOnly:true});
try {
  if(db.prepare("SELECT value FROM metadata WHERE key='payment_mode'").get()?.value!=='live')throw new Error('An existing sandbox ledger is required');
  const paypal=createPayPal(process.env);
  if(paypal.mode!=='live')throw new Error('Actual sandbox credentials are required');
  assertLedger(db);
  const report=await reconcile(db,paypal);
  const topups=db.prepare("SELECT * FROM topups WHERE status='CAPTURED' ORDER BY created_at").all().filter(r=>!JSON.parse(r.raw||'{}').seed);
  const payouts=db.prepare("SELECT * FROM payouts WHERE status='SUCCESS' AND dry_run=0 ORDER BY created_at").all().filter(r=>!JSON.parse(r.raw||'{}').seed);
  const accounts=db.prepare('SELECT kind,balance_micro,reserved_micro FROM accounts ORDER BY kind').all();
  const calls=db.prepare("SELECT status,price_micro,author_credit_micro FROM calls WHERE id NOT LIKE 'seed_%' ORDER BY created_at").all();
  const webhooks=db.prepare('SELECT id,event_type,verified,payload,received_at FROM webhook_events WHERE verified=1').all();
  const topupRows=report.rows.filter(r=>r.kind==='Top-up');
  const payoutRows=report.rows.filter(r=>r.kind==='Payout');
  const confirmed=r=>r.status==='MATCH'||r.api_status==='VERIFIED';
  let browser;try{browser=JSON.parse(readFileSync('data/verification/sandbox/browser-checkout.json','utf8'));}catch{}
  const browserMatches=browser?.observed_sdk_version?.startsWith('6.')&&browser.browser==='Google Chrome'&&topups.some(t=>t.paypal_order_id===browser.order_id);
  const duplicateEvents=db.prepare("SELECT COUNT(*) n FROM events WHERE kind='webhook.duplicate'").get().n;
  const captureEvents=webhooks.filter(w=>w.event_type==='PAYMENT.CAPTURE.COMPLETED'&&topups.some(t=>t.paypal_capture_id===JSON.parse(w.payload).resource?.id));
  const flow=topups.length===1&&topups[0].amount_micro===5_000_000&&calls.length===3&&calls.every(c=>c.status==='SETTLED'&&c.price_micro===10_000&&c.author_credit_micro===10_000)&&payouts.length===1&&payouts[0].amount_micro===30_000&&accounts.find(a=>a.kind==='consumer')?.balance_micro===4_970_000&&accounts.find(a=>a.kind==='provider')?.balance_micro===0&&accounts.every(a=>a.reserved_micro===0);
  const checks=[
    {check:'V1',result:topupRows.length&&topupRows.every(confirmed)?'PASS':'FAIL',notes:'Existing capture gross, USD fee and net checked against fresh PayPal API/reporting'},
    {check:'V2',result:browserMatches?'PASS':'MANUAL',notes:browserMatches?'Recorded browser observation: Google Chrome SDK '+browser.observed_sdk_version+' approval; matching captured order':'Browser checkout observation must be recorded separately'},
    {check:'V3',result:captureEvents.length?'PASS':'PENDING',notes:'Signature-verified capture events: '+captureEvents.length+'; verified duplicate deliveries: '+duplicateEvents+'; ledger invariant checked'},
    {check:'V4',result:payoutRows.length&&payoutRows.every(confirmed)?'PASS':'FAIL',notes:'Existing payout batch/item SUCCESS, amount, receiver, transaction id and USD fee checked'},
    {check:'V5',result:report.rows.length&&report.matched===report.rows.length?'PASS':report.rows.some(r=>r.status==='MISMATCH')?'FAIL':'PENDING',notes:report.matched+'/'+report.rows.length+' Reporting transactions reconciled; fee sources: '+[...new Set(report.rows.map(r=>r.fee_source||'Unverified'))].join(', ')+'. Reporting as of '+report.reporting_as_of},
    {check:'V6',result:'SKIP',notes:'Direct REST integration; PayPal Agent Toolkit is not claimed'},
    {check:'V7',result:'MANUAL',notes:'PayPal account reset not executed; preserve test evidence'},
    {check:'FLOW',result:flow?'PASS':'FAIL',notes:'One $5 capture, three $0.01 calls, one $0.03 successful payout; buyer $4.97, author $0, reserved $0'}
  ];
  const evidence={at:new Date().toISOString(),mode:'sandbox',read_only:true,checks,accounts,calls,report};
  mkdirSync('data/verification/sandbox',{recursive:true});
  writeFileSync('data/verification/sandbox/ledger-latest.json',JSON.stringify(evidence,null,2),{mode:0o600});
  console.log('PAYPAL SANDBOX — read-only verification of existing ledger\n');
  console.log('| Check | Result | Evidence |\n| --- | --- | --- |');
  for(const c of checks)console.log(`| ${c.check} | ${c.result} | ${c.notes.replaceAll('|','/')} |`);
  console.log('\nPrivate evidence: data/verification/sandbox/ledger-latest.json');
  if(checks.some(c=>c.result==='FAIL'))process.exitCode=1;
}finally{db.close();}
