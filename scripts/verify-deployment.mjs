// Read-only hosted proof: health, auth, exposed ledger identities and rail matching.
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
export function ledgerIdentity(state) {
  const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]??null]));
  const sorted=rows=>rows.sort((a,b)=>a.id.localeCompare(b.id));
  const identity={
    accounts:sorted([state.buyer,state.provider].map(a=>({...pick(a,['id','kind','balance_micro','reserved_micro','monthly_cap_micro','created_at']),api_key_hash:createHash('sha256').update(a.api_key).digest('hex')}))),
    tools:sorted(state.tools.map(t=>pick(t,['id','owner_account_id','price_micro','enabled']))),
    calls:sorted(state.calls.map(c=>pick(c,['id','account_id','tool_id','owner_account_id','price_micro','author_credit_micro','status','idempotency_key']))),
    topups:sorted(state.topups.map(t=>pick(t,['id','account_id','paypal_order_id','paypal_capture_id','amount_micro','fee_micro','status']))),
    payouts:sorted(state.payouts.map(p=>pick(p,['id','provider_account_id','paypal_batch_id','amount_micro','fee_micro','status','dry_run']))),
    policies:sorted(state.policies.map(p=>pick(p,['id','account_id','tool_id','scope','cap_micro','active','created_at'])))
  };
  return {sha256:createHash('sha256').update(JSON.stringify(identity)).digest('hex'),identity};
}
export async function verifyDeployment({base,token,expected,previous,allowPendingReport=false}) {
  const origin=new URL(base);
  if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('A public HTTPS backend origin is required');
  if(!token)throw new Error('DEMO_ACCESS_TOKEN is required');
  const get=path=>fetch(new URL(path,origin),{headers:{'X-Demo-Token':token},redirect:'error',signal:AbortSignal.timeout(60000)});
  const healthResponse=await get('/health'),health=await healthResponse.json();
  if(healthResponse.status!==200||health.mode!=='sandbox'||!health.instance_id)throw new Error('A running sandbox process with a boot identity is required');
  const anonymous=await fetch(new URL('/api/state',origin),{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(anonymous.status!==401)throw new Error('Anonymous ledger access must return 401');
  const stateResponse=await get('/api/state');if(stateResponse.status!==200)throw new Error('Operator authentication failed');
  const state=await stateResponse.json(),ledger=ledgerIdentity(state);
  if(expected&&ledger.sha256!==expected.sha256)throw new Error('Hosted ledger identities, balances or API keys differ from the frozen source');
  if(previous&&ledger.sha256!==previous.ledger.sha256)throw new Error('Ledger identities, balances or API keys changed after restart');
  if(previous&&health.instance_id===previous.health.instance_id)throw new Error('Process identity did not change after restart');
  const reportResponse=await get('/api/reconcile');if(reportResponse.status!==200)throw new Error('Hosted reconciliation failed');
  const report=await reportResponse.json();
  if(!report.rows.length||report.rows.some(r=>r.api_status==='MISMATCH'||r.status!=='MATCH'&&!(allowPendingReport&&r.api_status==='VERIFIED')))throw new Error(allowPendingReport?'Every rail receipt must match reporting or a fresh PayPal API check':'Every actual sandbox receipt must reconcile in Transaction Search');
  if(previous&&JSON.stringify(report.rows.map(r=>[r.id,r.reference,r.gross_micro,r.fee_micro]).sort())!==JSON.stringify(previous.report.rows.map(r=>[r.id,r.reference,r.gross_micro,r.fee_micro]).sort()))throw new Error('Rail receipt identities changed after restart');
  return {at:new Date().toISOString(),base:origin.origin,health,anonymous_state_http_status:anonymous.status,ledger,report,recent_events:state.events.map(e=>({id:e.id,kind:e.kind,created_at:e.created_at,payload:e.payload})),pass:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
    const value=flag=>{const i=process.argv.indexOf(flag);return i<0?undefined:process.argv[i+1];};
    const expected=value('--expected'),previous=value('--previous');
    const proof=await verifyDeployment({base:value('--base')||process.env.PUBLIC_BASE_URL,token:process.env.DEMO_ACCESS_TOKEN,expected:expected?JSON.parse(readFileSync(expected)):undefined,previous:previous?JSON.parse(readFileSync(previous)):undefined,allowPendingReport:process.argv.includes('--allow-pending-report')});
    const output=value('--out')||'data/verification/sandbox/deployment-latest.json';mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2),{mode:0o600});
    console.log(`PASS: hosted sandbox health; anonymous 401; ledger identity${expected?' matches frozen source':''}; ${proof.report.matched}/${proof.report.rows.length} reporting matches${process.argv.includes('--allow-pending-report')?'; all rail receipts verified':''}${previous?'; new process identity after restart':''}. Private evidence: ${output}`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
