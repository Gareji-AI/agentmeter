# AgentMeter — Design Decisions

Target: PayPal AI Hackathon (submission deadline 2026-11-12 12:00 PST).
Prize strategy: one Grand Prize or Honorable Mention, plus at most one Sponsor Prize.
AG Grid is the primary sponsor target; actual licensed Studio verification is pending.

## 1. One-line pitch

**AgentMeter is a metered billing rail for AI tools: an agent spends prepaid credit per tool
call, with PayPal sandbox funding and traceable author payout settlement. The current
verified demonstrations cover simulated funds and actual sandbox capture, signed
webhook delivery and successful author payout. Transaction Search matching is pending.**

## 2. Locked decisions

| # | Decision | Value | Why |
|---|----------|-------|-----|
| D1 | Judge-facing language | **English** | Rules require English submission materials. |
| D2 | Dev-facing language | English (code, comments, commits) | Keeps the repo coherent for judges. |
| D3 | Language / runtime | **JavaScript ES modules on Node 26**, zero npm deps | `node:sqlite` is built in — judges can run `npm start` without an install. |
| D4 | Money representation | **Integer micro-dollars** (`price_micro`) , 1 USD = 1,000,000 micro | Floating point on money is a disqualifying smell for a payments hackathon. Displayed as `$0.0100`. |
| D5 | Store of record | **agentmeter ledger**, not PayPal | PayPal sandbox has no realistic settlement lag model. Payouts are *initiated* by AgentMeter; PayPal is the money rail. |
| D6 | MCP transport | **Streamable HTTP** (`tools/list`, `tools/call`) at `POST /mcp` | Judges get a live URL; no `npx` install required. stdio bridge is a stretch goal. |
| D7 | UI | Server-rendered HTML + SSE live feed, no build step | A build step is a judge-experience risk. |
| D8 | Buyer agent | **scripted three-call plan, optional LLM narration** | See §5 — this is the load-bearing decision. |
| D9 | Top-up | **PayPal JS SDK v6 buttons** (client-side) + server capture | Judges click a real PayPal button. This is the strongest "PayPal is central" signal. |
| D10 | Payouts | Payouts API, one batch at a time, `sandbox` only; no flag executes, copied `.env.example` selects dry-run | Live payouts need approval; sandbox only. |
| D11 | Reconciliation | AgentMeter ledger vs PayPal Transaction Search plus separately labeled fresh Orders/Payouts checks, **explicit fee column** | Shows we understand that `order total ≠ money received`. This is the highest-credibility screen in the demo. |
| D12 | Hosting | Public information pages on Dotfield; Node backend deployed separately, with "run locally" in README | Dotfield provides stable public URLs; the backend needs a Node runtime and durable ledger storage. Render free instances lose local SQLite data on sleep/restart, so a persistent hosted ledger requires a paid instance with a disk or another suitable host. |

## 3. Verified vs. unverified PayPal surface

**Verified now (documentation):**

- Agent Toolkit MCP tool names and parameters
  (`create_order`, `pay_order`, `create_refund`, `get_order`, `list_transaction`,
  `get_merchant_insights`, `list_disputes`, `get_dispute`, `create_invoice`,
  `create_shipment_tracking`, subscription + catalog tools).
- Remote MCP endpoints: `https://mcp.sandbox.paypal.com`, `https://mcp.paypal.com`.
- Local MCP: `npx @paypal/mcp --tools=all` (v1.8.1), requires `PAYPAL_ACCESS_TOKEN`
  plus a sandbox/production flag.
- **`create_order` accepts a single `currency` for the whole order → a multi-currency
  cart is not representable through the toolkit tool.** This is a real design constraint.
- Agentic Commerce Services (Store Sync / Agent Ready) require **application + approval**.
  → **Do not gate any demo path on Agentic Commerce Services access.**
  → "Best Use of Agentic Commerce" is targeted by *implementing the ACP payment flow
  ourselves* (agent-initiated checkout, mandate/consent record), not by waiting on access.

**Actual sandbox verified — 2026-10-24:**

- Google Chrome SDK v6.70.0 approval; Orders capture completed for $5.00 USD.
- Capture fee $0.48 and net $4.52 are distinct from $5 of purchased tool credit.
- Public HTTPS capture Webhook passed PayPal signature verification and did not
  credit an already captured order twice.
- Three $0.01 calls settled; a $0.03 Payouts batch and its single item both reached
  SUCCESS after USD platform test prefunding. No dry-run is used for this evidence.
- Fresh GET Orders/Payouts reads independently agree with the ledger.

**Still pending:** Transaction Search has not reported the new capture/payout yet.
A fresh API verification is displayed separately from `MATCH`, which means actual
Transaction Search amount, status and fee agreement. Stored receipts alone cannot
produce either an API verification or a reporting match. API failures remain visible;
checks are read-only and bounded to 20 non-matched records per refresh. See
`06-sandbox-evidence.md` for observed evidence, prefunding and hosting limitations.

## 4. Architecture

```
                    ┌───────────────────────────────────────────┐
  Buyer agent ──────►  POST /mcp  (Streamable HTTP)            │
  (or any MCP client)│  ├─ tools/list                             │
                    │  └─ tools/call                             │
                    └───────────────┬───────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │  Metering pipeline     │
                        │  1. auth (api key)     │
                        │  2. price lookup       │
                        │  3. reserve funds      │
                        │  4. invoke tool        │
                        │  5. commit / refund    │
                        └───────────┬───────────┘
                                    │
        ┌───────────────────────────▼────────────────────────────┐
        │ SQLite ledger (node:sqlite, WAL)                        │
        │ accounts · tools · calls · topups · payouts · events    │
        └───────────────────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────▼────────────────────────────┐
        │ PayPal (sandbox)                                        │
        │  Orders v2      ← prepaid top-up                        │
        │  Webhooks       ← PAYMENT.CAPTURE.COMPLETED (idempotent)│
        │  Payouts v1     ← author settlement                     │
        │  Transaction Search ← reconciliation                    │
        └────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────▼────────────────────────────┐
        │ UI: /app  /provider  /reconcile  /grid  (SSE live)      │
        └────────────────────────────────────────────────────────┘
```

### Request lifecycle (one metered call)

1. `POST /mcp` with `Authorization: Bearer am_live_<key>`.
2. Resolve account → check `monthly_cap_micro` and per-tool cap.
3. `balance_available = balance - reserved`. If `< price` → JSON-RPC error
   `-32002 INSUFFICIENT_FUNDS` with a `topup_url` in `data` (agent can surface it).
4. Insert `calls` row `status=RESERVED` with an idempotency key
   (`client request id` or `hash(account, tool, args, minute)`).
5. Invoke the tool (built-in deterministic tools first, upstream HTTP/MCP tools stretch).
6. Success → `status=SETTLED`, decrement `balance`, append `events` row.
   Failure → `status=RELEASED`, no charge.
7. SSE pushes the ledger row to `/app`.

Reserve-then-settle means a crashed process never silently under-charges or double-charges,
and the UI can show `reserved` vs `settled` — which is exactly the kind of detail that
reads as "genuine effort" under Technological Implementation.

## 5. The buyer-agent decision (load-bearing)

The buyer demonstration executes a fixed plan of three deterministic entity-extraction
calls. Each call passes through the same reservation, cap and settlement path as MCP.
Insufficient funds or a cap stops spending; a tool failure releases its reservation.
There is no autonomous model-driven purchase or cheaper-tool retry in this version.

Optional Gemini adapters interpret budget/widget intent, narrate already-settled
facts, and label synthetic historical examples. Model output is validated against
explicit user amounts, named tools and whitelisted fields; it cannot change prices,
execute tools, generate SQL or initiate payments. Without a key, budget and analytics
requests use a documented rule parser and narration is literal. No actual Gemini
response has been verified as of 2026-10-24.

Optional AG Studio uses a custom analyst agent delegating to the built-in page agent.
Its adapter is implemented but requires a trial/license key and browser verification.
The offline table and local widgets are the verified analytics path today.

## 6. Data model

```sql
accounts(
  id text pk, kind text,            -- 'consumer' | 'provider'
  display_name text,
  paypal_email text,
  api_key text unique,
  balance_micro integer default 0,
  reserved_micro integer default 0,
  monthly_cap_micro integer,         -- null = unlimited
  created_at text)

tools(
  id text pk, owner_account_id text,
  name text, slug text unique,
  description text,
  price_micro integer,
  upstream_kind text,                -- 'builtin' | 'http'
  upstream_url text,
  enabled integer default 1)

calls(
  id text pk, account_id text, tool_id text,
  price_micro integer, status text,  -- RESERVED | SETTLED | RELEASED
  idempotency_key text unique,
  request_args text, response_preview text, error text,
  latency_ms integer, created_at text, settled_at text)

topups(
  id text pk, account_id text,
  paypal_order_id text unique, amount_micro integer,
  status text,                       -- CREATED | CAPTURED | FAILED
  raw text, created_at text)

payouts(
  id text pk, provider_account_id text,
  amount_micro integer, fee_micro integer,
  paypal_batch_id text, status text,
  dry_run integer, created_at text)

events(id integer pk autoincrement, kind text, payload text, created_at text)
```

Invariants enforced in code and asserted by tests:

- Consumer balance = captured top-ups − settled call prices.
- Provider balance = settled author credits − successful payout amounts.
- Consumer reserved = active call reservations; provider reserved = queued/sent payouts.
- Every balance/reservation is a safe, nonnegative integer; reserved cannot exceed balance.
- Fees are recorded separately; this prototype does not implement refunds or FX.

The SQL above is a domain sketch; `src/db.mjs` is the complete executable schema,
including `webhook_events`, `budget_policies`, capture IDs and snapshotted author credits.
Tools are pure local functions between reservation and settlement transactions. One
server process recovers stale tool reservations on startup. Payouts retain unresolved
reservations across restart and reuse the same external batch identity.

## 7. Scope

### Must ship (Day 1–10)

1. Ledger + reserve/settle metering + idempotency.
2. MCP Streamable HTTP with six built-in metered tools.
3. PayPal Orders top-up (JS SDK v6 + server capture) + webhook idempotency.
4. Consumer dashboard (`/app`): balance, live call feed, natural-language cap.
5. Provider dashboard (`/provider`): revenue per tool, unsettled balance, Pay out.
6. Payouts API integration with dry-run + batch status polling.
7. Reconciliation view (`/reconcile`): ledger vs Transaction Search.
8. Seed script + README so a judge reaches a working state in < 5 minutes.

### Should ship (Day 11–14)

9. AG Grid analytics view (`/grid`) — dense per-tool/per-day matrix, CSV export.
10. Second agent (a "seller agent" that self-registers a tool and sets a price).
11. Failure drill: budget breach mid-run, tool error → no charge, duplicate webhook.

### Won't ship

- Store Sync / Agent Ready onboarding (needs PayPal approval).
- Real-time FX / multi-currency charging (toolkit `create_order` is single-currency).
- Mobile clients.
- Actual payouts in live mode.

## 8. Non-goals that judges might expect (say them out loud in the README)

- Not a payment processor — we never touch card data.
- Not a custodial wallet for real money in this prototype — sandbox funds only.
- Not trying to beat Stripe Billing — we meter *machine-to-machine* micro-transactions,
  which is a segment that card rails price out of existence.

## 9. Design quality bar

"Design" is an equally-weighted criterion. Concretely:

- One type scale, one accent colour, no gradients, no emoji in the UI.
- Every money value uses tabular numerals and 4-decimal precision.
- Every state change is visible (reserved → settled) — a money UI that hides its own
  state changes is the failure mode.
- Empty states explain what to click.
- The three screens a judge touches are reachable from `/` in one click.

2026-10-24 refinement: Open Design 0.19.1 supplied a five-screen design-polish
reference. The live SSR app adopts its forest palette, warm surfaces, 52px primary
balance, larger working labels, and paired tool/receipt panels. Synthetic history
is disclosed separately from live receipts. Reconciliation summaries derive from
returned receipt states; there is no static all-clear. Route navigation and a
three-step money trail remain ordinary links. See `05-ui-design.md`.

## 10. Public information pages

The project website and English information pages live on the existing Dotfield site:

| Purpose | URL |
|---|---|
| Project website | https://dotfield.xyz/apps/agentmeter/ |
| Privacy | https://dotfield.xyz/apps/agentmeter/privacy/ |
| Terms | https://dotfield.xyz/apps/agentmeter/terms/ |
| Support | https://dotfield.xyz/apps/agentmeter/support/ |

These Astro pages are static. They are not the interactive demo or a PayPal webhook
listener. Keep `PUBLIC_BASE_URL` pointed at the AgentMeter server, not Dotfield.
Register `<backend HTTPS origin>/api/webhooks/paypal` once the server is deployed.
Payment secrets stay on the backend and must never enter Dotfield's static build.

Update the project website with a verified demo link when the application is ready.
Until then, the public pages describe a prototype in development and label the
balance example as illustrative.
