import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('consumer','provider')),
  display_name    TEXT NOT NULL,
  paypal_email    TEXT,
  api_key         TEXT NOT NULL UNIQUE,
  balance_micro   INTEGER NOT NULL DEFAULT 0,
  reserved_micro  INTEGER NOT NULL DEFAULT 0,
  monthly_cap_micro INTEGER,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  id                TEXT PRIMARY KEY,
  owner_account_id  TEXT NOT NULL REFERENCES accounts(id),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL,
  price_micro       INTEGER NOT NULL,
  input_schema      TEXT NOT NULL,
  handler           TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  tool_id           TEXT NOT NULL REFERENCES tools(id),
  owner_account_id  TEXT NOT NULL REFERENCES accounts(id),
  price_micro       INTEGER NOT NULL,
  platform_fee_micro INTEGER NOT NULL DEFAULT 0,
  author_credit_micro INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('RESERVED','SETTLED','RELEASED')),
  idempotency_key   TEXT NOT NULL UNIQUE,
  request_args      TEXT,
  response_preview  TEXT,
  error             TEXT,
  latency_ms        INTEGER,
  created_at        TEXT NOT NULL,
  settled_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_calls_account ON calls(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_tool ON calls(tool_id, created_at DESC);

CREATE TABLE IF NOT EXISTS topups (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  paypal_order_id  TEXT NOT NULL UNIQUE,
  amount_micro     INTEGER NOT NULL,
  fee_micro        INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL CHECK (status IN ('CREATED','CAPTURED','FAILED')),
  raw              TEXT,
  created_at       TEXT NOT NULL,
  captured_at      TEXT
);

CREATE TABLE IF NOT EXISTS payouts (
  id                  TEXT PRIMARY KEY,
  provider_account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_micro        INTEGER NOT NULL,
  paypal_batch_id     TEXT,
  status              TEXT NOT NULL CHECK (status IN ('QUEUED','SENT','SUCCESS','FAILED','DRY_RUN')),
  dry_run             INTEGER NOT NULL DEFAULT 0,
  payload             TEXT,
  raw                 TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  verified    INTEGER NOT NULL DEFAULT 0,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_policies (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts(id),
  scope          TEXT NOT NULL,
  tool_id        TEXT,
  cap_micro      INTEGER NOT NULL,
  source_text    TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDb(path = process.env.DATABASE_PATH || 'data/agentmeter.sqlite') {
  const file = path === ':memory:' ? path : resolve(path);
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  db.exec('PRAGMA busy_timeout = 5000');
  const columns = db.prepare('PRAGMA table_info(topups)').all();
  if (!columns.some(c => c.name === 'paypal_capture_id')) db.exec('ALTER TABLE topups ADD COLUMN paypal_capture_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_id ON topups(paypal_capture_id)');
  if (!db.prepare('PRAGMA table_info(payouts)').all().some(c => c.name === 'fee_micro')) db.exec('ALTER TABLE payouts ADD COLUMN fee_micro INTEGER NOT NULL DEFAULT 0');
  const amounts = {
    accounts: ['balance_micro', 'reserved_micro'], tools: ['price_micro'],
    calls: ['price_micro', 'platform_fee_micro', 'author_credit_micro'],
    topups: ['amount_micro', 'fee_micro'], payouts: ['amount_micro', 'fee_micro'], budget_policies: ['cap_micro'],
  };
  for (const [table, fields] of Object.entries(amounts)) {
    const invalid = fields.map(f => `(typeof(NEW.${f}) != 'integer' OR NEW.${f} < 0 OR NEW.${f} > 9007199254740991)`).join(' OR ');
    const extra = table === 'accounts' ? ' OR NEW.reserved_micro > NEW.balance_micro OR (NEW.monthly_cap_micro IS NOT NULL AND (typeof(NEW.monthly_cap_micro) != \'integer\' OR NEW.monthly_cap_micro < 0 OR NEW.monthly_cap_micro > 9007199254740991))' : '';
    for (const action of ['INSERT', 'UPDATE']) db.exec(`CREATE TRIGGER IF NOT EXISTS guard_${table}_${action} BEFORE ${action} ON ${table} WHEN ${invalid}${extra} BEGIN SELECT RAISE(ABORT, 'invalid monetary invariant'); END`);
  }
  return db;
}

const transactionDepth = new WeakMap();
/** Acquire the writer lock before reading balances; nested operations use savepoints. */
export function transaction(db, fn) {
  const name = `tx_${randomUUID().replaceAll('-', '')}`;
  const depth = transactionDepth.get(db) || 0;
  db.exec(depth ? `SAVEPOINT ${name}` : 'BEGIN IMMEDIATE');
  transactionDepth.set(db, depth + 1);
  try {
    const value = fn();
    if (value?.then) throw new TypeError('database transactions must be synchronous');
    db.exec(depth ? `RELEASE ${name}` : 'COMMIT');
    return value;
  } catch (error) {
    db.exec(depth ? `ROLLBACK TO ${name}; RELEASE ${name}` : 'ROLLBACK');
    throw error;
  } finally {
    transactionDepth.set(db, depth);
  }
}

export const nowIso = () => new Date().toISOString();

let counter = 0;
export function newId(prefix) {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function newApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `am_live_${hex}`;
}

/** Append to the event log and return the row so SSE clients can echo it. */
export function emit(db, kind, payload) {
  const createdAt = nowIso();
  const info = db
    .prepare('INSERT INTO events (kind, payload, created_at) VALUES (?,?,?)')
    .run(kind, JSON.stringify(payload), createdAt);
  return { id: Number(info.lastInsertRowid), kind, payload, created_at: createdAt };
}
