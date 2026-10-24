const $=selector=>document.querySelector(selector);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dollars=value=>{const n=BigInt(value);return `$${n/1000000n}.${String(n%1000000n).padStart(6,'0').slice(0,abs%100n?6:4)}`;};
const cash=value=>`<span class="money">${dollars(value)}</span>`;
const badge=value=>`<span class="status">${h(value)}</span>`;
const table=(headings,rows)=>`<div class="table-scroll" tabindex="0"><table><thead><tr>${headings.map(x=>`<th scope="col">${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
let noticeTimer;
const notice=message=>{$('#customer-notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('#customer-notice').textContent='';},8000);};
const pending=new Map();
async function api(path,body) {
  if(body&&!pending.has(path))pending.set(path,crypto.randomUUID());
  const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(body?{'Idempotency-Key':pending.get(path)}:{})},body:body?JSON.stringify(body):undefined});
  const result=await response.json();
  if(!response.ok){if(response.status<500)pending.delete(path);throw new Error(result.error||'Request failed');}
  pending.delete(path);return result;
}
async function busy(button,work){if(button.disabled)return;button.disabled=true;try{notice('');await work();}catch(e){notice(e.message);}finally{button.disabled=false;}}
const render=(selector,html)=>{const node=$(selector);if(node.innerHTML!==html)node.innerHTML=html;};
async function refresh() {
  const state=await api('/api/customer/state'),a=state.account;
  $('#customer-balance').textContent=dollars(a.balance_micro-a.reserved_micro);$('#customer-reserved').textContent=dollars(a.reserved_micro);
  $('#customer-cap').textContent=state.policies[0]?`Active monthly limit: ${dollars(state.policies[0].cap_micro)}`:'No custom monthly limit. Available prepaid credit still limits spending.';
  render('#customer-keys',state.keys.length?table(['Label','Identifier','State','Action'],state.keys.map(k=>[h(k.label),`…${h(k.suffix)}`,badge(k.revoked_at?'REVOKED':'ACTIVE'),k.revoked_at?'—':`<button type="button" class="text-button" data-revoke="${h(k.id)}">Revoke</button>`])):'<p>No client keys yet. Create one to connect your agent.</p>');
  render('#customer-calls',state.calls.length?table(['Tool / receipt','State','Charged','Author credit'],state.calls.map(c=>[`<strong>${h(c.tool_name)}</strong><small>${h(c.id)}</small>`,badge(c.status),cash(c.status==='SETTLED'?c.price_micro:0),cash(c.status==='SETTLED'?c.author_credit_micro:0)])):'<p>No tool calls yet. Connect Codex, then run the sample request.</p>');
  render('#customer-topups',state.topups.length?table(['Top-up','State','Gross credit','Fee','Net cash'],state.topups.map(t=>[h(t.paypal_order_id),badge(t.status),cash(t.amount_micro),t.status==='CAPTURED'?cash(t.fee_micro):'—',t.status==='CAPTURED'?cash(t.amount_micro-t.fee_micro):'—'])):'<p>No top-ups yet. Add test credit above.</p>');
}
$('#signup-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{
  const result=await api('/api/customer/workspaces',{name:new FormData(event.target).get('name')});
  event.target.hidden=true;$('#recovery-code').textContent=result.recovery_code;$('#recovery-ready').hidden=false;$('#recovery-ready').scrollIntoView({block:'center'});
});});
$('#customer-signin')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await api('/api/customer/session',{recovery_code:new FormData(event.target).get('recovery_code')});location.assign('/workspace');});});
$('#customer-logout')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{await api('/api/customer/logout',{});location.assign('/sign-in');}));
$('#customer-key-form')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{
  const result=await api('/api/customer/keys',{label:new FormData(event.target).get('label')});$('#client-key-value').textContent=result.key;$('#client-key-ready').hidden=false;$('#customer-key-form').hidden=true;await refresh();notice('Client key created. Save it now; it is shown only once.');
});});
$('#hide-client-key')?.addEventListener('click',()=>{$('#client-key-value').textContent='';$('#client-key-ready').hidden=true;$('#customer-key-form').hidden=false;});
$('#customer-budget')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await api('/api/customer/budget',{amount:new FormData(event.target).get('amount')});await refresh();notice('Monthly limit updated. Already settled and reserved usage counts toward it.');});});
document.addEventListener('click',event=>{
  const copy=event.target.closest('[data-copy]');if(copy)busy(copy,async()=>{await navigator.clipboard.writeText(document.getElementById(copy.dataset.copy).textContent);notice('Copied. Store secrets privately.');});
  const revoke=event.target.closest('[data-revoke]');if(revoke)busy(revoke,async()=>{await api(`/api/customer/keys/${revoke.dataset.revoke}/revoke`,{});$('#hide-client-key').click();await refresh();notice('Key revoked. Its next request will be rejected.');});
});
$('#customer-topup')?.addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{
  const result=await api('/api/customer/topups',{amount:new FormData(event.target).get('amount')});
  $('#customer-checkout').replaceChildren();
  if(result.approve_url?.includes('/mock/checkout/')) {
    const approve=document.createElement('button');approve.type='button';approve.textContent='Approve simulated top-up';
    approve.addEventListener('click',()=>busy(approve,async()=>{await api('/api/customer/mock/approve',{topup_id:result.id});$('#customer-checkout').replaceChildren();await refresh();notice('Simulated top-up captured once. Your credit is ready.');}));$('#customer-checkout').append(approve);
  } else if(result.approve_url)location.assign(result.approve_url);
  else throw new Error('Approval link unavailable. No credit was added.');
  await refresh();
});});
$('#customer-capture')?.addEventListener('click',event=>busy(event.currentTarget,async()=>{await api(`/api/customer/topups/${event.currentTarget.dataset.topup}/capture`,{});location.assign('/workspace#funds');}));
if($('#customer-balance'))setInterval(()=>{if(!document.hidden)refresh().catch(e=>notice(e.message));},5000);
