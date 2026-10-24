import { emit, newId, nowIso, transaction } from './db.mjs';
import { integer, microToPayPalAmount, paypalAmountToMicro } from './money.mjs';
import { MeteringError } from './metering.mjs';

export function creditCapture(db, topupId, order) {
  return transaction(db,()=>{
    const topup=db.prepare('SELECT * FROM topups WHERE id=?').get(topupId);
    if(!topup)throw new Error('Unknown top-up');
    if(topup.status==='CAPTURED')return topup;
    const captures=order.purchase_units?.flatMap(unit=>unit.payments?.captures||[])||[];
    const capture=captures.find(c=>c.status==='COMPLETED');
    if(order.id!==topup.paypal_order_id || order.status!=='COMPLETED' || !capture || captures.length!==1 || capture.amount.currency_code!=='USD' || paypalAmountToMicro(capture.amount.value)!==topup.amount_micro) throw new Error('Capture does not match the expected order, currency or amount');
    const breakdown=capture.seller_receivable_breakdown;
    const fee=breakdown?.paypal_fee ? paypalAmountToMicro(breakdown.paypal_fee.value) : breakdown?.net_amount ? topup.amount_micro-paypalAmountToMicro(breakdown.net_amount.value) : null;
    if(fee===null)throw new Error('Capture fee or net amount is required for reconciliation');
    integer(fee);if(fee>topup.amount_micro)throw new Error('Invalid fee');
    db.prepare("UPDATE topups SET status='CAPTURED',paypal_capture_id=?,fee_micro=?,raw=?,captured_at=? WHERE id=?").run(capture.id,fee,JSON.stringify(order),nowIso(),topup.id);
    db.prepare('UPDATE accounts SET balance_micro=balance_micro+? WHERE id=?').run(topup.amount_micro,topup.account_id);
    emit(db,'topup.captured',{account_id:topup.account_id,topup_id:topup.id,amount_micro:topup.amount_micro});
    return db.prepare('SELECT * FROM topups WHERE id=?').get(topup.id);
  });
}

export async function createTopup(db,paypal,accountId,amountMicro,key) {
  integer(amountMicro);
  if(amountMicro<10_000 || amountMicro>100_000_000 || amountMicro%10_000) throw new MeteringError(-32602,'Top-up must be $0.01–$100.00 in whole cents');
  if(typeof key!=='string'||!key||key.length>100)throw new MeteringError(-32602,'Idempotency-Key is required');
  const id='topup_'+(await import('node:crypto')).createHash('sha256').update(accountId+'\0'+key).digest('hex').slice(0,40);
  let row=db.prepare('SELECT * FROM topups WHERE id=?').get(id);
  if(row && (row.amount_micro!==amountMicro||row.account_id!==accountId))throw new MeteringError(-32003,'IDEMPOTENCY_CONFLICT');
  if(!row){db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,created_at) VALUES (?,?,?,?,'CREATED',?)").run(id,accountId,'PENDING-'+id,amountMicro,nowIso());row=db.prepare('SELECT * FROM topups WHERE id=?').get(id);}
  let order;
  if(!row.paypal_order_id.startsWith('PENDING-'))order=JSON.parse(row.raw);
  else {
    order=await paypal.createOrder({amountMicro,reference:id,description:'AgentMeter sandbox tool credits'});
    if(!order.id)throw new Error('PayPal did not return an order id');
    db.prepare('UPDATE topups SET paypal_order_id=?,raw=? WHERE id=?').run(order.id,JSON.stringify(order),id);
  }
  return {id,order_id:order.id,status:row.status,approve_url:order.links?.find(link=>link.rel==='approve'||link.rel==='payer-action')?.href};
}

export async function captureTopup(db,paypal,accountId,topupId) {
  const row=db.prepare('SELECT * FROM topups WHERE id=? AND account_id=?').get(topupId,accountId);
  if(!row)throw new MeteringError(-32602,'Unknown top-up');
  if(row.status==='CAPTURED')return row;
  return creditCapture(db,row.id,await paypal.captureOrder(row.paypal_order_id));
}

export async function processWebhook(db,paypal,event,{verified=false}={}) {
  if(!verified)throw new MeteringError(-32001,'UNVERIFIED_WEBHOOK');
  if(typeof event.id!=='string'||!event.id||event.id.length>200||typeof event.event_type!=='string')throw new Error('Invalid webhook');
  if(db.prepare('SELECT id FROM webhook_events WHERE id=?').get(event.id))return {duplicate:true};
  const orderId=event.resource?.supplementary_data?.related_ids?.order_id;
  const topup=orderId?db.prepare('SELECT * FROM topups WHERE paypal_order_id=?').get(orderId):null;
  let order;
  if(topup&&event.event_type==='PAYMENT.CAPTURE.COMPLETED') {
    order=topup.status==='CAPTURED'?JSON.parse(topup.raw):await paypal.approveOrder(orderId);
    const capture=order.purchase_units?.[0]?.payments?.captures?.[0];
    if(capture?.id!==event.resource?.id)throw new Error('Webhook capture id mismatch');
  }
  return transaction(db,()=>{
    if(db.prepare('SELECT id FROM webhook_events WHERE id=?').get(event.id))return {duplicate:true};
    db.prepare('INSERT INTO webhook_events (id,event_type,verified,payload,received_at) VALUES (?,?,1,?,?)').run(event.id,event.event_type,JSON.stringify(event),nowIso());
    if(order)creditCapture(db,topup.id,order);
    if(topup&&event.event_type==='PAYMENT.CAPTURE.DENIED'&&topup.status!=='CAPTURED')db.prepare("UPDATE topups SET status='FAILED' WHERE id=? AND status!='CAPTURED'").run(topup.id);
    emit(db,'webhook.accepted',{event_id:event.id,event_type:event.event_type});
    return {duplicate:false,applied:Boolean(topup)};
  });
}

export function applyPayoutStatus(db,payoutId,batch) {
  return transaction(db,()=>{
    const row=db.prepare('SELECT * FROM payouts WHERE id=?').get(payoutId);
    if(!row||!['QUEUED','SENT'].includes(row.status))return row;
    const batchId=batch.batch_header?.payout_batch_id;
    if(!batchId || (row.paypal_batch_id&&batchId!==row.paypal_batch_id))throw new Error('Payout batch id mismatch');
    const status=batch.batch_header?.batch_status;
    const items=batch.items||[];
    const success=status==='SUCCESS'&&items.length===1&&items[0].transaction_status==='SUCCESS';
    const failed=['DENIED','CANCELED'].includes(status)||items.some(i=>['FAILED','RETURNED','BLOCKED','DENIED','CANCELED','REFUNDED'].includes(i.transaction_status));
    if(success) {
      const item=items[0].payout_item;
      const expected=JSON.parse(row.payload).items[0];
      if(item?.amount?.currency!=='USD'||paypalAmountToMicro(item.amount.value)!==row.amount_micro||item.receiver!==expected.receiver)throw new Error('Payout receipt does not match amount or receiver');
    }
    const next=success?'SUCCESS':failed?'FAILED':'SENT';
    const fee=success?paypalAmountToMicro(items[0].payout_item_fee?.value||'0.00'):0;
    db.prepare('UPDATE payouts SET paypal_batch_id=?,status=?,fee_micro=?,raw=?,updated_at=? WHERE id=?').run(batchId,next,fee,JSON.stringify(batch),nowIso(),payoutId);
    if(success||failed)db.prepare('UPDATE accounts SET reserved_micro=reserved_micro-?,balance_micro=balance_micro-? WHERE id=?').run(row.amount_micro,success?row.amount_micro:0,row.provider_account_id);
    emit(db,'payout.updated',{payout_id:payoutId,account_id:row.provider_account_id,status:next});
    return db.prepare('SELECT * FROM payouts WHERE id=?').get(payoutId);
  });
}

export async function payOut(db,paypal,providerId,{dryRun=false}={}) {
  let row=transaction(db,()=>{
    const active=db.prepare("SELECT * FROM payouts WHERE provider_account_id=? AND status IN ('QUEUED','SENT') ORDER BY created_at LIMIT 1").get(providerId);
    if(active)return active;
    const account=db.prepare("SELECT * FROM accounts WHERE id=? AND kind='provider'").get(providerId);
    if(!account?.paypal_email)throw new MeteringError(-32602,'Provider sandbox email is required');
    const amount=Number(BigInt(account.balance_micro-account.reserved_micro)/10_000n*10_000n);
    if(!amount)throw new MeteringError(-32002,'No whole-cent earnings available');
    const id=newId('payout');
    const payload={senderBatchId:id,emailSubject:'AgentMeter sandbox earnings',items:[{recipient_type:'EMAIL',amount:{currency:'USD',value:microToPayPalAmount(amount)},receiver:account.paypal_email,sender_item_id:id}]};
    db.prepare('INSERT INTO payouts (id,provider_account_id,amount_micro,status,dry_run,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,providerId,amount,dryRun?'DRY_RUN':'QUEUED',dryRun?1:0,JSON.stringify(payload),nowIso(),nowIso());
    if(!dryRun)db.prepare('UPDATE accounts SET reserved_micro=reserved_micro+? WHERE id=?').run(amount,providerId);
    emit(db,'payout.queued',{payout_id:id,account_id:providerId,dry_run:dryRun});
    return db.prepare('SELECT * FROM payouts WHERE id=?').get(id);
  });
  if(row.status==='DRY_RUN')return row;
  try {
    const batch=row.paypal_batch_id?await paypal.getPayout(row.paypal_batch_id):await paypal.createPayout(JSON.parse(row.payload));
    return applyPayoutStatus(db,row.id,batch);
  } catch(error) {
    // Ambiguous network failures keep the reservation; retries reuse senderBatchId.
    if(error.status>=400&&error.status<500&&![408,409,429].includes(error.status))transaction(db,()=>{
      const current=db.prepare('SELECT * FROM payouts WHERE id=?').get(row.id);
      if(!['QUEUED','SENT'].includes(current.status))return;
      db.prepare("UPDATE payouts SET status='FAILED',raw=?,updated_at=? WHERE id=?").run(JSON.stringify({error:error.message,status:error.status}),nowIso(),row.id);
      db.prepare('UPDATE accounts SET reserved_micro=reserved_micro-? WHERE id=?').run(current.amount_micro,current.provider_account_id);
      emit(db,'payout.updated',{payout_id:row.id,account_id:providerId,status:'FAILED'});
    });
    throw error;
  }
}

export async function reconcile(db,paypal) {
  const now=new Date();let remote;let source='PayPal Transaction Search';let error=null;
  try { remote=await paypal.listTransactions({startDate:new Date(now.getTime()-30*86400000).toISOString(),endDate:now.toISOString()}); }
  catch(e){source='Stored capture receipts only';error=e.message;remote={transaction_details:[]};}
  const transactions=new Map((remote.transaction_details||[]).map(row=>[row.transaction_info.transaction_id,row.transaction_info]));
  const rows=[];
  for(const topup of db.prepare("SELECT * FROM topups WHERE status='CAPTURED' ORDER BY created_at DESC").all()) {
    const raw=JSON.parse(topup.raw||'{}');if(raw.seed)continue;
    const capture=raw.purchase_units?.[0]?.payments?.captures?.[0];
    const external=transactions.get(topup.paypal_capture_id);
    const amount=external?.transaction_amount?.currency_code==='USD'?paypalAmountToMicro(external.transaction_amount.value):null;
    const fee=external?.fee_amount?Math.abs(paypalAmountToMicro(external.fee_amount.value)):null;
    const match=external?.transaction_status==='S'&&amount===topup.amount_micro&&fee===topup.fee_micro;
    rows.push({id:topup.id,reference:topup.paypal_capture_id||topup.paypal_order_id,kind:'Top-up',gross_micro:topup.amount_micro,fee_micro:topup.fee_micro,net_micro:topup.amount_micro-topup.fee_micro,rail_micro:amount,status:match?'MATCH':error&&capture?'RECEIPT_ONLY':external?'MISMATCH':'PENDING_REPORT'});
  }
  for(const payout of db.prepare("SELECT * FROM payouts WHERE status='SUCCESS' ORDER BY created_at DESC").all()) {
    const raw=JSON.parse(payout.raw||'{}');if(raw.seed)continue;
    const ref=raw.items?.[0]?.transaction_id;const external=transactions.get(ref);
    const amount=external?.transaction_amount?.currency_code==='USD'?paypalAmountToMicro(external.transaction_amount.value):null;
    rows.push({id:payout.id,reference:ref||payout.paypal_batch_id,kind:'Payout',gross_micro:-payout.amount_micro,fee_micro:payout.fee_micro,net_micro:-payout.amount_micro-payout.fee_micro,rail_micro:amount,status:external?.transaction_status==='S'&&amount===-payout.amount_micro?'MATCH':external?'MISMATCH':'PENDING_REPORT'});
  }
  return {source:paypal.mode==='mock'?'Mock PayPal reporting (simulated)':source,error,rows,matched:rows.filter(r=>r.status==='MATCH').length};
}
