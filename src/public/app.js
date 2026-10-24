const boot=JSON.parse(document.querySelector('#boot').textContent);
const $=selector=>document.querySelector(selector);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dollars=value=>{const n=BigInt(value||0);const abs=n<0n?-n:n;return `${n<0n?'-':''}$${abs/1000000n}.${String(abs%1000000n).padStart(6,'0').slice(0,4)}`;};
const cash=value=>`<span class="money">${dollars(value)}</span>`;
const badge=value=>`<span class="status ${h(String(value).toLowerCase())}">${h(value)}</span>`;
export const rowsTable=(headings,rows)=>`<div class="table-scroll"><table><thead><tr>${headings.map(t=>`<th>${h(t)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
let noticeTimer;
export function notice(message){$('#notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('#notice').textContent='';},8000);}
const pendingKeys=new Map();
export async function api(path,body,key) {
  const operation=key||path;
  if(body!==undefined&&!pendingKeys.has(operation))pendingKeys.set(operation,crypto.randomUUID());
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(body===undefined?{}:{'Idempotency-Key':pendingKeys.get(operation)})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok){if(response.status<500)pendingKeys.delete(operation);const error=new Error(result.error||'Request failed');error.code=result.code;error.data=result.data;throw error;}
  pendingKeys.delete(operation);return result;
}
async function busy(button,fn){if(button.disabled)return;button.disabled=true;const label=button.textContent;button.textContent='Working…';try{await fn();}catch(e){notice(e.message+(e.code===-32002?' — add test funds to continue.':''));}finally{button.disabled=false;button.textContent=label;}}
function text(id,value){const node=$(id);if(node)node.textContent=value;}
export let state;
export async function refreshState() {
  state=await api('/api/state');
  const buyer=state.buyer,author=state.provider;
  text('#buyer-balance',dollars(buyer.balance_micro));text('#available-balance',dollars(buyer.balance_micro-buyer.reserved_micro));text('#reserved-balance',dollars(buyer.reserved_micro));
  text('#author-balance',dollars(author.balance_micro));text('#author-available',dollars(author.balance_micro-author.reserved_micro));text('#payout-reserved',dollars(author.reserved_micro));
  text('#session-spend',dollars(state.calls.filter(c=>c.status==='SETTLED'&&!c.id.startsWith('seed_')).reduce((n,c)=>n+c.price_micro,0)));
  if($('#calls-table'))$('#calls-table').innerHTML=rowsTable(['Tool / call','State','Price','Latency','Time (UTC)'],state.calls.slice(0,35).map(c=>[`<strong>${h(c.tool_name)}</strong><small class="mono">${h(c.id.slice(-12))}</small>`,badge(c.status),cash(c.status==='RELEASED'?0:c.price_micro),`${c.latency_ms??'—'} ms`,h(c.created_at.slice(11,19))]));
  if($('#events-feed'))$('#events-feed').innerHTML=`<ol class="event-feed">${state.events.slice(0,10).map(e=>`<li><span class="event-dot"></span><span><strong>${h(e.kind)}</strong><small>${h(JSON.parse(e.payload).call_id?.slice(-12)||JSON.parse(e.payload).payout_id?.slice(-12)||'Ledger event')}</small></span><time>${h(e.created_at.slice(11,19))}</time></li>`).join('')}</ol>`;
  if($('#policies'))$('#policies').innerHTML=state.policies.map(p=>`<p class="policy">${h(p.tool_id||'All tools')}<b>${cash(p.cap_micro)} / month</b></p>`).join('')||'<p class="muted">No custom cap. Available funds still limit spending.</p>';
  if($('#payouts-table'))$('#payouts-table').innerHTML=state.payouts.length?rowsTable(['Batch','State','Amount','Receipt / payload'],state.payouts.slice(0,15).map(p=>[h(p.paypal_batch_id||p.id),badge(p.status),cash(p.amount_micro),`<details><summary>View details</summary><pre>${h(JSON.stringify({request:JSON.parse(p.payload||'{}'),response:JSON.parse(p.raw||'{}')},null,2))}</pre></details>`])):'<p class="muted">No payouts yet. Run tool calls as a buyer first.</p>';
  window.dispatchEvent(new CustomEvent('agentmeter:state',{detail:state}));return state;
}
async function refreshReport(){const report=await api('/api/reconcile');text('#matched-records',String(report.matched));text('#reconcile-source',report.source+(report.error?` · ${report.error}`:''));if($('#reconcile-table'))$('#reconcile-table').innerHTML=rowsTable(['Record / rail reference','Ledger gross','Fee','Net cash','Rail amount','Result'],report.rows.map(r=>[`<strong>${h(r.kind)}</strong><small class="mono">${h(r.reference)}</small>`,cash(r.gross_micro),cash(r.fee_micro),cash(r.net_micro),r.rail_micro===null?'Awaiting report':cash(r.rail_micro),badge(r.status)]));return report;}

$('#login-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await api('/api/session',{token:new FormData(event.target).get('token')});location.reload();});});
$('#demo-run')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{const run=await api('/api/demo',{});notice(run.narration);await refreshState();}));
$('#tool-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{const form=new FormData(event.target);const called=await api('/api/call',{name:form.get('name'),arguments:JSON.parse(form.get('arguments'))});$('#tool-result').textContent=JSON.stringify(called.result,null,2);notice(`Settled ${dollars(called.call.price_micro)} · ${called.reused?'existing receipt replayed':'author credited'}`);await refreshState();});});
const samples={extract_entities:{text:'Contact demo@example.com about $5.00.'},summarize_text:{text:'Agents use tools. Every call needs a receipt. Budgets keep costs predictable.',maxSentences:2},keyword_extract:{text:'Metering creates receipts. Receipts explain metering costs.',limit:5},diff_json:{left:{plan:'free'},right:{plan:'paid'}},slugify_batch:{items:['Agent Meter','Tool receipts']},validate_links:{text:'See https://example.com and http://example.org.'}};
const toolSelect=$('#tool-form select');if(toolSelect){toolSelect.value='extract_entities';toolSelect.addEventListener('change',()=>{$('#tool-form textarea').value=JSON.stringify(samples[toolSelect.value],null,2);});}
$('#failure-drill')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{try{await api('/api/call',{name:'slugify_batch',arguments:{items:Array(201).fill('failure drill')}});}catch(e){if(e.code!==-32006)throw e;notice('Tool failed. The $0.0200 reservation was released. No charge.');await refreshState();}}));
$('#budget-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{const result=await api('/api/budget',{text:new FormData(event.target).get('text')});notice(`Monthly cap: ${dollars(result.intent.capMicro)} · ${result.intent.toolId||'all tools'}`);await refreshState();});});
$('#payout-run')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{const payout=await api('/api/payout',{});notice(`Payout ${payout.status.toLowerCase()} · ${dollars(payout.amount_micro)}${payout.status==='SENT'||payout.status==='QUEUED'?' — click again to poll safely with the same batch.':''}`);await refreshState();}));
$('#reconcile-run')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{const report=await refreshReport();notice(`${report.matched} records match ${boot.mode==='mock'?'simulated reporting':'PayPal reporting'}.`);}));

let checkoutOrder;
async function newOrder(){checkoutOrder=await api('/api/topup',{amount:new FormData($('#topup-form')).get('amount')});return {orderId:checkoutOrder.order_id};}
$('#topup-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await newOrder();if(boot.mode==='mock'){
  const button=document.createElement('button');button.textContent='Approve simulated top-up';button.className='secondary';button.addEventListener('click',()=>busy(button,async()=>{await api('/api/mock/approve',{topup_id:checkoutOrder.id});notice('Simulated capture completed. Test funds credited once.');$('#checkout-actions').replaceChildren();await refreshState();}));$('#checkout-actions').replaceChildren(button);
}else if(checkoutOrder.approve_url){const link=document.createElement('a');link.href=checkoutOrder.approve_url;link.className='button secondary';link.textContent='Approve on PayPal sandbox ↗';$('#checkout-actions').replaceChildren(link);notice('Order created. Continue to PayPal sandbox, then capture the approved order.');}else notice('This order is already captured.');}));});
$('#capture-return')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{await refreshState();const orderId=event.target.dataset.order;const topup=state.topups.find(t=>t.paypal_order_id===orderId);if(!topup)throw new Error('Approved order not found in this workspace. Open the buyer workspace.');await api(`/api/topup/${topup.id}/capture`,{});notice('Capture completed. Test funds credited once.');setTimeout(()=>location.assign('/app'),800);}));

async function setupPayPal(){
  if(boot.mode!=='sandbox'||!$('#paypal-button'))return;
  try {
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.sandbox.paypal.com/web-sdk/v6/core';script.async=true;script.onload=resolve;script.onerror=reject;document.head.append(script);});
    const sdk=await window.paypal.createInstance({clientId:boot.clientId,components:['paypal-payments'],pageType:'checkout',locale:'en-US'});
    const methods=await sdk.findEligibleMethods({currencyCode:'USD'});if(!methods.isEligible('paypal'))return;
    const session=sdk.createPayPalOneTimePaymentSession({async onApprove(data){if(data.orderId!==checkoutOrder?.order_id){notice('Order mismatch. Capture was not attempted.');return;}await api(`/api/topup/${checkoutOrder.id}/capture`,{});notice('PayPal sandbox capture completed.');await refreshState();},onCancel(){notice('PayPal checkout cancelled. No balance was credited.');},onError(){notice('PayPal SDK checkout failed. The redirect checkout is also available.');}});
    const button=$('#paypal-button');button.hidden=false;button.addEventListener('click',()=>session.start({presentationMode:'auto'},newOrder()).catch(()=>notice('Checkout could not start. Try the redirect checkout.')));
  }catch(e){notice('PayPal SDK unavailable. Use the redirect checkout.');}
}

if(boot.authenticated) {
  try{await refreshState();const events=new EventSource('/events?after='+(state.events[0]?.id||0));let timer;events.addEventListener('ledger',()=>{clearTimeout(timer);timer=setTimeout(()=>refreshState().catch(()=>{}),100);});window.addEventListener('pagehide',()=>events.close(),{once:true});}
  catch(e){notice('Workspace could not refresh: '+e.message);}
  setupPayPal();
  if(location.pathname==='/grid')import('/assets/grid.js').catch(()=>notice('Analytics extension unavailable. The table remains usable.'));
}
