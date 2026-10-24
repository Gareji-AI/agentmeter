# AgentMeter

Meter tool calls, reserve a budget, and pay authors from a traceable ledger.
Built for the PayPal AI Hackathon. This prototype supports **simulated funds and
PayPal sandbox test funds only**; production PayPal hosts are rejected.

The complete local mock demo works without accounts, API keys, a package install,
network access, or a build step. Real sandbox approval and payout verification are
still incomplete; see the evidence table below.

## Run in one minute

Requirements: **Node.js 26+** and Git.

```sh
git clone https://github.com/Gareji-AI/agentmeter.git
cd agentmeter
npm start
```

Open **http://localhost:8787**. Startup seeds one consumer, one provider, six tools,
180 synthetic calls across the previous 30 days, and **$5.0000 simulated credit**.
The repository is currently private, so cloning requires repository access.
`npm install` is unnecessary: there are zero runtime npm dependencies.

1. Open **Buyer** and click **Run 3 calls**. Balance becomes **$4.9700**.
2. Open **Provider**. Available author earnings are **$0.0300**. Click **Pay out**.
3. Open **Reconcile**. The simulated funding receipt and outgoing payout both match.
4. Open **Analytics**. Create “Show daily spend this month”, move/remove widget cards,
   and export CSV. No analytics license or model key is required for this path.

Every screen says which payment mode is active. Historical seed entries are marked
synthetic and excluded from external reconciliation. The mock fee is illustrative,
not a quote of PayPal's pricing; a $5 simulated receipt shows gross $5, fee $0.66,
net $4.34. Buyers receive the purchased $5 of tool credit; the platform absorbs
funding fees. Provider balances track author earnings, not gross PayPal receipts.

If port 8787 is occupied:

```sh
PAYPAL_MODE=mock PORT=8788 npm start
```

Existing `.env` credentials select sandbox unless `PAYPAL_MODE=mock` is explicit.
Modes use separate SQLite files under ignored `data/`, and reject a database marked
for the other mode. Seed is idempotent. To prepare another fresh demo without
changing existing data:

```sh
PAYPAL_MODE=mock DATABASE_PATH=data/recording-1.sqlite npm start
```

To erase the selected **mock** ledger, stop its server first, then run
`PAYPAL_MODE=mock npm run reset -- --confirm`. This command never resets sandbox.

## Verify

```sh
npm test
npm run verify:demo
npm run verify:sandbox -- --mock
```

Tests cover exact integer money, two-connection reservations, idempotency conflicts,
exhaustion, monthly and per-tool caps, rollback/release, capture replay, forged and
mismatched receipts, payout ambiguity, MCP HTTP behavior, SSR escaping, and browser
JavaScript syntax. `verify:demo` boots an isolated seeded process, opens all five
screens, runs the $5 → $4.97 → $0.03 → payout → reconciliation flow, and removes its
temporary ledger. It makes no external requests.

## PayPal sandbox setup

Copy `.env.example` to `.env`. Set `PAYPAL_MODE=sandbox`, the sandbox app's
`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`, and `PAYPAL_SANDBOX_RECIPIENT` to a
personal sandbox account. Credentials and database files must stay out of Git.
Use a USD-funded sandbox business account for USD payouts. Optional separate
`PAYPAL_PAYOUT_CLIENT_ID` / `PAYPAL_PAYOUT_CLIENT_SECRET` select a payout business app.

Sandbox starts with **zero spendable credit**. Open the server, sign in with the
startup console's demo access token (or set `DEMO_ACCESS_TOKEN`), then approve a
top-up with a personal sandbox buyer. The JS SDK v6 checkout is implemented with a
PayPal approval-link fallback; server capture alone credits the ledger. Browser
rendering and completed real checkout still need verification.

The copied template sets `PAYOUT_MODE=dry-run`: the provider sees the exact REST
payload without sending it. Set `PAYOUT_MODE=execute` to send sandbox test funds.
With no flag, sandbox payouts execute; mock payouts always simulate execution.
An ambiguous payout keeps its reservation; a retry reuses the same sender batch ID.
A successful batch **and item receipt** are required to debit earnings.

Set `PUBLIC_BASE_URL` to the backend's actual origin. Register
`https://YOUR-BACKEND/api/webhooks/paypal` for `PAYMENT.CAPTURE.COMPLETED` and
`PAYMENT.CAPTURE.DENIED`, and set `PAYPAL_WEBHOOK_ID`. Incoming events require PayPal
signature verification, then deduplicate by event and capture. An unregistered
webhook fails closed. The static Dotfield pages cannot receive webhooks.

```sh
npm run verify:sandbox
# Approve the printed URL using a personal sandbox account, then:
npm run verify:sandbox -- --order-id APPROVED_ORDER_ID
# Optional: actually sends $0.03 in sandbox, independently of PAYOUT_MODE:
npm run verify:sandbox -- --order-id APPROVED_ORDER_ID --payout
```

Private raw evidence goes to `data/verification/{mock,sandbox}/latest.json`.
Manual checks remain MANUAL; simulated passes never count as real PayPal passes.

## Sandbox verification — 2026-10-24

| Check | Local simulation | Actual PayPal sandbox evidence |
| --- | --- | --- |
| V1 Orders / capture / fee | PASS | PENDING: order creation works; buyer approval/capture not completed |
| V2 JS SDK v6 | Separate browser step | MANUAL: real checkout not yet verified |
| V3 webhook / signature | PASS for replay logic only | MANUAL: public backend and webhook registration missing |
| V4 $0.03 payout | PASS; also exercised in browser | FAIL: HTTP 422 `INSUFFICIENT_FUNDS`; seller has JPY funding, no usable USD funding |
| V5 Transaction Search | PASS; gross/fee/net match | API accessible; capture match PENDING until completed funding is reported |
| V6 PayPal Agent Toolkit | SKIP | SKIP: direct REST selected; Toolkit use is not claimed |
| V7 account reset | Local reset implemented | MANUAL: PayPal account reset not executed |

OAuth and Payouts/Reporting app capabilities were checked. This is **not** evidence
that real automatic author payouts have passed. The working video path currently
uses simulated funds. See [the verification plan](docs/02-sandbox-verification.md).

## MCP and HTTP

`POST /mcp` implements sessionless Streamable HTTP with JSON responses:
`initialize`, `ping`, `tools/list`, `tools/call`. Send
`Accept: application/json, text/event-stream` and `Authorization: Bearer YOUR_BUYER_KEY`.
The Buyer screen exposes its own demo API key after sign-in. Send a unique
`Idempotency-Key` for each intended call and reuse it when retrying. If omitted,
`tools/call` uses the JSON-RPC request ID; reuse of an ID therefore replays that call.

Insufficient available funds returns JSON-RPC **-32002** with `data.topup_url`.
Monthly caps return **-32004**. Reusing a key with different arguments returns
**-32003**. A failed tool releases the reservation and charges zero.

| Tool | Price per successful call |
| --- | ---: |
| `extract_entities` | $0.0100 |
| `summarize_text` | $0.0250 |
| `keyword_extract` | $0.0150 |
| `diff_json` | $0.0050 |
| `slugify_batch` | $0.0200 |
| `validate_links` | $0.0100 |

These six tools are deterministic local transformations. Link validation checks
syntax, not remote availability. No tool calls a model or the network.
Screens: `/`, `/app`, `/provider`, `/reconcile`, `/grid`. SSE: `/events`.
Payment routes: `/api/topup`, `/api/topup/:id/capture`, `/api/payout`,
`/api/webhooks/paypal`. `/health` is a lightweight readiness check.

## Tools used

- **Node.js 26 / node:sqlite / native fetch / node:test**: ES modules, SQLite WAL,
  SSR, HTTP, tests; no build or runtime package installation.
- **PayPal Orders v2, Payouts v1, Transaction Search, Webhook Verification REST**:
  sandbox funding, provider settlement, receipt comparison and event authentication.
  **JavaScript SDK v6**: optional sandbox approval UI, dynamically loaded only there.
- **MCP Streamable HTTP**: exposes the metered tools to protocol clients. The buyer
  demonstration uses a scripted three-call plan, with explicit ledger receipts.
- **AG Grid 36.2.0 / AG Studio 3.0.0**: optional licensed analytics modules, loaded
  from pinned CDN versions. Quartz theming, custom money/status cells, a micro-USD
  receipt widget, editable layout, and a custom Studio agent delegating to the built-in
  page agent are implemented. **No trial key yet: the licensed runtime path has not
  been verified. AG Grid sponsor readiness is pending that check.** Without licenses,
  the SSR table, CSV, rule-based natural-language widgets and local card layout work
  offline. Set `AG_GRID_LICENSE_KEY` / `AG_STUDIO_LICENSE_KEY` to enable the adapters.
- **Gemini**: optional REST adapter for validated budget/widget intent, narration
  after settlement, and semantic labels of synthetic history. Default model:
  `gemini-3.8-flash`, configurable through `GEMINI_MODEL`. **No API key has been
  supplied, so actual model use is not claimed.** Rules and literal narration are
  used instead. Model output cannot generate SQL, prices, tool execution or payouts.
- **APIMatic Context Plugin for PayPal / Codex**: installed from the hackathon's
  [PayPal plugin source](https://github.com/paypaldev/server-sdk-context-plugin-preview).
  Its TypeScript getting-started, authentication, error and resilience skills were
  read during development. Following its source-grounding guidance, SDK 2.5.0 source
  was inspected for optional capture fee/net fields and transport defaults. This
  informed USD breakdown validation, explicit deadlines and conservative payout
  retries. AgentMeter uses native REST, not the SDK as a runtime dependency. See
  [development evidence](docs/04-development-evidence.md).
- **Open Design 0.19.1 (MCP)**: five-screen audit and design-polish reference; its
  visual system was adapted into the live SSR views and browser renderers. Prototype
  fixtures remain outside the application. See [design notes](docs/05-ui-design.md).
- **Codex**: implementation and browser-assisted checks. **Dotfield / Cloudflare**:
  public information pages, not the Node application. Render is not deployed.

## Ledger boundaries and hosting

All stored monetary values are safe integer micro-USD. `BigInt` intermediates avoid
floating-point arithmetic; only `microToPayPalAmount` produces PayPal decimal strings.
Reservations use SQLite `BEGIN IMMEDIATE`; retries replay the stored result. Monthly
spend includes active reservations. On startup, stale tool reservations are released;
this assumes one application process and pure local tools, not arbitrary side effects.
Pending payout reservations survive restart and must be polled/retried to resolve.

Consumer balance = captured credit − settled tool charges. Provider balance =
settled author credits − successful payouts. Author credit is currently 100% of the
call price; a platform fee can be enabled in the metering API. External funding fees
and payout fees are explicit expenses; they are not silently deducted from tool credit.
This prototype has no production onboarding, refunds, FX, or persistent user auth.

For hosting, use one Node process, `HOST=0.0.0.0`, `PORT` from the host, a backend
`PUBLIC_BASE_URL` (or `RENDER_EXTERNAL_URL`), and durable SQLite storage. Fast process
startup does not remove platform wake-up time. On Render free hosting, **the first
load may take up to a minute**, and filesystem changes are ephemeral. Use free
hosting only for an explicitly resettable mock demo; a persistent sandbox ledger
needs durable storage. No paid backend has been provisioned.

Public information: [project](https://dotfield.xyz/apps/agentmeter/),
[privacy](https://dotfield.xyz/apps/agentmeter/privacy/),
[terms](https://dotfield.xyz/apps/agentmeter/terms/),
[support](https://dotfield.xyz/apps/agentmeter/support/).

Design source: [decisions](docs/00-decisions.md). Submission draft:
[submission](docs/03-submission.md). Recording guide:
[demo script](docs/01-demo-script.md). License: [MIT](LICENSE).
