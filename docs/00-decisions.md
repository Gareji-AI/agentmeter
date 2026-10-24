# AgentMeter — Design Decisions

Target: PayPal AI Hackathon (submission deadline 2026-11-12 12:00 PST).
Prizes targeted: Grand Prize, Best Use of Agentic Commerce, Best Use of PayPal + AI,
Most Creative, Best Demo Delivery, Best Use of AG Grid (stretch), Best Use of APIMatic (stretch).

## 1. One-line pitch

**AgentMeter is a metered billing rail for AI tools: an AI agent pays $0.01 per tool
call in PayPal, and tool authors get paid out automatically.**

## 2. Locked decisions

| # | Decision | Value | Why |
|---|----------|-------|-----|
| D1 | Judge-facing language | **English** | Rules require English submission materials. |
| D2 | Dev-facing language | English (code, comments, commits) | Keeps the repo coherent for judges. |
| D3 | Language / runtime | **TypeScript on Node 26**, zero native deps | `node:sqlite` is built in — judges can run it with only `npm install`. |
| D4 | Money representation | **Integer micro-dollars** (`price_micro`) , 1 USD = 1,000,000 micro | Floating point on money is a disqualifying smell for a payments hackathon. Displayed as `$0.0100`. |
| D5 | Store of record | **agentmeter ledger**, not PayPal | PayPal sandbox has no realistic settlement lag model. Payouts are *initiated* by AgentMeter; PayPal is the money rail. |
| D6 | MCP transport | **Streamable HTTP** (`tools/list`, `tools/call`) at `POST /mcp` | Judges get a live URL; no `npx` install required. stdio bridge is a stretch goal. |
| D7 | UI | Server-rendered HTML + SSE live feed, no build step | A build step is a judge-experience risk. |
| D8 | Buyer agent | **scripted plan, LLM narration** | See §5 — this is the load-bearing decision. |
| D9 | Top-up | **PayPal JS SDK v6 buttons** (client-side) + server capture | Judges click a real PayPal button. This is the strongest "PayPal is central" signal. |
| D10 | Payouts | Payouts API, one batch at a time, dry-run flag default **off**, `sandbox` only | Live payouts need approval; sandbox only. |
| D11 | Reconciliation | AgentMeter ledger vs PayPal Transaction Search, **explicit fee column** | Shows we understand that `order total ≠ money received`. This is the highest-credibility screen in the demo. |
| D12 | Hosting | Render free tier (sponsor prize) + "run locally" in README | Hosted URL is the safer demo path; local instructions satisfy the rules regardless. |

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

**Unverified (must be proven on Day 1 — see `02-sandbox-verification.md`):**

- Payouts API sandbox batch behaviour (toolkit has no payouts tool → direct REST).
- Whether the `/v1/payments/payouts` sandbox requires extra business account setup.
- Webhook signature verification headers on sandbox.
- Whether `Transaction Search` returns a fee breakdown field usable for reconciliation.
- Whether JS SDK v6 buttons render on a sandbox-only client ID without a business account.

**Kill switches:** if Payouts sandbox fails → auto-payout becomes "queued payout with
documented REST payload + dry-run mode"; the Payouts integration still counts, but the
demo stops there. If Transaction Search fee data is unavailable → the reconciliation view
computes the fee as `order_total − net_amount` where net comes from the `/capture` response.

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

A hackathon demo that spends LLM tokens live will hang on stage. But the judging rubric
rewards AI being *meaningful*, not *flaky*.

**Decision: the buyer agent is a deterministic planner with an LLM narrator.**

- The planner is a small state machine that reacts to real tool output
  (e.g. it stops when a `402`-equivalent comes back, it retries with a cheaper tool when
  over budget).
- The LLM (Gemini Flash) produces the *narration* and the *budget intent* from natural
  language ("keep this tool under $0.50 this month") → parsed into
  `monthly_cap_micro`.
- The LLM also performs the one genuinely AI-hard step: **semantic batch assignment** of
  historical calls to tools (for the AG Grid analytics view) — i.e. it reads tool
  descriptions + call args and labels clusters.

This is defensible in the submission text: "AI decides intent and budget policy; the
metering path is deterministic so money never depends on a model's mood." Judges who
have shipped payments will read that as a *plus*.

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

Invariant enforced in code and asserted by a test:
`balance_micro = Σ(settled calls and completed topups) − Σ(payouts and refunds)`.

## 7. Scope

### Must ship (Day 1–10)

1. Ledger + reserve/settle metering + idempotency.
2. MCP Streamable HTTP with 3–5 built-in metered tools.
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
