import { createHash } from 'node:crypto';
import { emit, newId, nowIso, transaction } from './db.mjs';
import { feeOf, integer } from './money.mjs';
import { BUILTIN_HANDLERS } from './tools.mjs';

export class MeteringError extends Error {
  constructor(code, message, data = {}) { super(message); this.code = code; this.data = data; }
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function accountForKey(db, apiKey) {
  const account = db.prepare('SELECT * FROM accounts WHERE api_key = ?').get(apiKey || '');
  if (!account) throw new MeteringError(-32001, 'UNAUTHORIZED');
  return account;
}

export function monthWindow(at = nowIso()) {
  const date = new Date(at);
  return [new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString(), new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()];
}

export function reserve(db, { accountId, toolName, args = {}, idempotencyKey, at = nowIso(), platformFeeBps = 0 }) {
  if (typeof idempotencyKey !== 'string' || !idempotencyKey || idempotencyKey.length > 200) throw new MeteringError(-32602, 'An idempotency key of 1–200 characters is required');
  const requestArgs = canonical(args);
  const key = createHash('sha256').update(`${accountId}\0${idempotencyKey}`).digest('hex');
  return transaction(db, () => {
    const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND kind = 'consumer'").get(accountId);
    if (!account) throw new MeteringError(-32001, 'CONSUMER_REQUIRED');
    const tool = db.prepare('SELECT * FROM tools WHERE name = ? OR slug = ?').get(toolName, toolName);
    if (!tool) throw new MeteringError(-32602, 'UNKNOWN_TOOL');
    const previous = db.prepare('SELECT * FROM calls WHERE idempotency_key = ?').get(key);
    if (previous) {
      if (previous.tool_id !== tool.id || previous.request_args !== requestArgs) throw new MeteringError(-32003, 'IDEMPOTENCY_CONFLICT');
      return { call: previous, tool, reused: true };
    }
    if (!tool.enabled) throw new MeteringError(-32602, 'TOOL_DISABLED');
    const owner = db.prepare("SELECT id FROM accounts WHERE id = ? AND kind = 'provider'").get(tool.owner_account_id);
    if (!owner) throw new MeteringError(-32603, 'TOOL_OWNER_INVALID');
    const price = integer(tool.price_micro);
    const fee = feeOf(price, platformFeeBps);
    if (account.balance_micro - account.reserved_micro < price) throw new MeteringError(-32002, 'INSUFFICIENT_FUNDS', { topup_url: '/app#topup', available_micro: account.balance_micro - account.reserved_micro, required_micro: price });
    const [start, end] = monthWindow(at);
    const spent = (toolId) => db.prepare(`SELECT COALESCE(SUM(price_micro),0) AS n FROM calls WHERE account_id = ? AND status IN ('RESERVED','SETTLED') AND created_at >= ? AND created_at < ? ${toolId ? 'AND tool_id = ?' : ''}`).get(...[accountId, start, end, ...(toolId ? [toolId] : [])]).n;
    const caps = db.prepare('SELECT * FROM budget_policies WHERE account_id = ? AND active = 1').all(accountId);
    if (account.monthly_cap_micro !== null) caps.push({ scope: 'monthly', cap_micro: account.monthly_cap_micro });
    for (const policy of caps) {
      if (policy.tool_id && policy.tool_id !== tool.id) continue;
      if (spent(policy.tool_id) + price > policy.cap_micro) throw new MeteringError(-32004, 'BUDGET_EXCEEDED', { cap_micro: policy.cap_micro, scope: policy.scope });
    }
    const id = newId('call');
    db.prepare(`INSERT INTO calls (id,account_id,tool_id,owner_account_id,price_micro,platform_fee_micro,author_credit_micro,status,idempotency_key,request_args,created_at) VALUES (?,?,?,?,?,?,?,'RESERVED',?,?,?)`).run(id, accountId, tool.id, owner.id, price, fee, price - fee, key, requestArgs, at);
    db.prepare('UPDATE accounts SET reserved_micro = reserved_micro + ? WHERE id = ?').run(price, accountId);
    emit(db, 'call.reserved', { call_id: id, account_id: accountId, price_micro: price });
    return { call: db.prepare('SELECT * FROM calls WHERE id = ?').get(id), tool, reused: false };
  });
}

export function settle(db, callId, result, latencyMs = 0) {
  return transaction(db, () => {
    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId);
    if (!call) throw new MeteringError(-32602, 'UNKNOWN_CALL');
    if (call.status === 'SETTLED') return call;
    if (call.status !== 'RESERVED') throw new MeteringError(-32003, 'CALL_ALREADY_RELEASED');
    const response = JSON.stringify(result);
    if (response === undefined) throw new TypeError('tool result must be JSON serializable');
    db.prepare('UPDATE accounts SET reserved_micro = reserved_micro - ?, balance_micro = balance_micro - ? WHERE id = ?').run(call.price_micro, call.price_micro, call.account_id);
    db.prepare('UPDATE accounts SET balance_micro = balance_micro + ? WHERE id = ?').run(call.author_credit_micro, call.owner_account_id);
    db.prepare("UPDATE calls SET status = 'SETTLED', response_preview = ?, latency_ms = ?, settled_at = ? WHERE id = ?").run(response, Math.max(0, Math.round(latencyMs)), nowIso(), callId);
    emit(db, 'call.settled', { call_id: callId, account_id: call.account_id, price_micro: call.price_micro });
    return db.prepare('SELECT * FROM calls WHERE id = ?').get(callId);
  });
}

export function release(db, callId, error = 'Execution failed') {
  return transaction(db, () => {
    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId);
    if (!call) throw new MeteringError(-32602, 'UNKNOWN_CALL');
    if (call.status !== 'RESERVED') return call;
    db.prepare('UPDATE accounts SET reserved_micro = reserved_micro - ? WHERE id = ?').run(call.price_micro, call.account_id);
    db.prepare("UPDATE calls SET status = 'RELEASED', error = ?, settled_at = ? WHERE id = ?").run(String(error).slice(0, 1000), nowIso(), callId);
    emit(db, 'call.released', { call_id: callId, account_id: call.account_id });
    return db.prepare('SELECT * FROM calls WHERE id = ?').get(callId);
  });
}

export function validateArgs(schema, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new MeteringError(-32602, 'arguments must be an object');
  for (const key of schema.required || []) if (!Object.hasOwn(args, key)) throw new MeteringError(-32602, `Missing argument: ${key}`);
  for (const [key, value] of Object.entries(args)) {
    const rule = schema.properties?.[key];
    if (!rule) throw new MeteringError(-32602, `Unknown argument: ${key}`);
    const valid = rule.type === 'array' ? Array.isArray(value) && value.every(v => typeof v === rule.items.type) : rule.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : typeof value === rule.type;
    if (!valid) throw new MeteringError(-32602, `Invalid argument: ${key}`);
  }
}

/** Pure built-ins execute synchronously; no transaction spans network or model I/O. */
export function callTool(db, options, handlers = BUILTIN_HANDLERS) {
  const tool = db.prepare('SELECT * FROM tools WHERE name = ? OR slug = ?').get(options.toolName, options.toolName);
  if (!tool) throw new MeteringError(-32602, 'UNKNOWN_TOOL');
  validateArgs(JSON.parse(tool.input_schema), options.args || {});
  const reservation = reserve(db, options);
  if (reservation.reused) {
    if (reservation.call.status === 'RESERVED') throw new MeteringError(-32005, 'CALL_IN_PROGRESS');
    if (reservation.call.status === 'RELEASED') throw new MeteringError(-32006, reservation.call.error || 'CALL_RELEASED');
    return { call: reservation.call, result: JSON.parse(reservation.call.response_preview), reused: true };
  }
  const start = performance.now();
  try {
    const handler = handlers[tool.handler];
    if (!handler) throw new Error('Handler unavailable');
    const result = handler(options.args || {});
    if (result?.then) throw new Error('Built-in handlers must be synchronous');
    return { call: settle(db, reservation.call.id, result, performance.now() - start), result, reused: false };
  } catch (error) {
    release(db, reservation.call.id, error.message);
    throw new MeteringError(-32006, 'TOOL_FAILED', { detail: error.message });
  }
}

export function setBudget(db, accountId, { capMicro, toolId = null, sourceText = '' }) {
  integer(capMicro, 'cap');
  return transaction(db, () => {
    if (!db.prepare("SELECT id FROM accounts WHERE id = ? AND kind = 'consumer'").get(accountId)) throw new MeteringError(-32001, 'CONSUMER_REQUIRED');
    if (toolId && !db.prepare('SELECT id FROM tools WHERE id = ?').get(toolId)) throw new MeteringError(-32602, 'UNKNOWN_TOOL');
    db.prepare('UPDATE budget_policies SET active = 0 WHERE account_id = ? AND tool_id IS ?').run(accountId, toolId);
    const id = newId('budget');
    db.prepare('INSERT INTO budget_policies (id,account_id,scope,tool_id,cap_micro,source_text,created_at) VALUES (?,?,?,?,?,?,?)').run(id, accountId, toolId ? 'tool_monthly' : 'monthly', toolId, capMicro, sourceText, nowIso());
    emit(db, 'budget.updated', { account_id: accountId, cap_micro: capMicro, tool_id: toolId });
    return id;
  });
}

export function recoverReservations(db) {
  for (const call of db.prepare("SELECT id FROM calls WHERE status = 'RESERVED'").all()) release(db, call.id, 'Process restarted before settlement; no charge');
}

export function assertLedger(db) {
  for (const account of db.prepare('SELECT * FROM accounts').all()) {
    const sum = (sql) => db.prepare(sql).get(account.id).n;
    const balance = account.kind === 'consumer'
      ? sum("SELECT COALESCE(SUM(amount_micro),0) n FROM topups WHERE account_id = ? AND status = 'CAPTURED'") - sum("SELECT COALESCE(SUM(price_micro),0) n FROM calls WHERE account_id = ? AND status = 'SETTLED'")
      : sum("SELECT COALESCE(SUM(author_credit_micro),0) n FROM calls WHERE owner_account_id = ? AND status = 'SETTLED'") - sum("SELECT COALESCE(SUM(amount_micro),0) n FROM payouts WHERE provider_account_id = ? AND status = 'SUCCESS'");
    const reserved = account.kind === 'consumer'
      ? sum("SELECT COALESCE(SUM(price_micro),0) n FROM calls WHERE account_id = ? AND status = 'RESERVED'")
      : sum("SELECT COALESCE(SUM(amount_micro),0) n FROM payouts WHERE provider_account_id = ? AND status IN ('QUEUED','SENT')");
    if (account.balance_micro !== balance || account.reserved_micro !== reserved) throw new Error(`Ledger invariant failed for ${account.id}`);
  }
  if (db.prepare("SELECT id FROM calls WHERE status = 'SETTLED' AND price_micro != platform_fee_micro + author_credit_micro").get()) throw new Error('Call allocation invariant failed');
  return true;
}
