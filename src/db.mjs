import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  const file = resolve(path);
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
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
