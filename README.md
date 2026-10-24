# AgentMeter

Meter tool calls, reserve a budget, and pay authors from a traceable ledger.
Built for the PayPal AI Hackathon. This prototype supports **simulated funds and
PayPal sandbox test funds only**; production PayPal hosts are rejected.

The complete local mock demo works without accounts, API keys, a package install,
network access, or a build step. Actual sandbox funding, SDK v6 approval, verified
webhooks, author payout and Transaction Search reconciliation have also passed.
See the evidence table below.

GitHub uses the organization's Free plan with $0 stop-usage budgets. Repository
metadata, CI permissions and the private-repository branch protection limitation
are documented in [repository settings](docs/11-repository-settings.md).

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
for the other mode. Seed is idempotent.

## Personal sandbox workspaces

Open `/join` to create your own buyer workspace. Save the one-time recovery code;
it signs you back in at `/sign-in`. New workspaces start with **zero** credit.
Approve a sandbox top-up, create a named client key, then copy the MCP URL and
Codex configuration from `/workspace`. Your page contains only your balance,
funding receipts, keys and tool-call receipts. Operator analytics and the global
ledger remain behind the separate operator sign-in. `/sell` manages your own provider
tools and sandbox payouts.

For a fresh, isolated local demonstration with no credentials or model calls:

```sh
npm run demo:users
```

Open its printed `/join` URL. It uses a new mock ledger, clears payment/model/license
credentials and requires operator sign-in even in mock mode. The private `take.json`
contains the local operator token for demonstrating author payout separately.
The ordinary offline `npm start` demo retains its convenience auto-login in mock
mode. Set `PUBLIC_WORKSPACES=1` and a private `DEMO_ACCESS_TOKEN` when sharing a mock
server; sandbox mode always requires operator authentication.

Personal client keys are shown once and stored as hashes. Copy a new key privately
into `AGENTMETER_BUYER_KEY` in the environment that launches Codex. The configuration
on the workspace page contains only an environment-variable reference. Client keys
cannot sign into the web console or use operator/credit-management APIs.
Recovery codes and seven-day session tokens are also hashed at rest. Legacy seeded
operator-demo account keys retain their existing representation for compatibility.

Public-key MCP calls require a unique `_request_id` argument (or explicit
`Idempotency-Key` header). The schema advertises it. Reuse it only for retries;
JSON-RPC IDs alone can repeat across client connections. A monthly limit set on
the workspace page includes settled and reserved usage; changing a prompt is not
a server-side budget control. Revoke a key to block its next request.

```sh
npm run verify:workspace
```

This isolated HTTP check proves signup → $5 mock credit → personal key → two
invoice-text extractions and one URL-format check → $4.97 → $0.03 author payout,
plus replay, cap, isolation and revocation. Global mock reporting has three matches:
the seeded operator top-up, personal top-up and author payout. Personal funding
receipts are scoped and do not claim independent Transaction Search verification.
Actual Codex app-server Bearer authentication and discovery of six tools were also
verified locally and against the hosted endpoint; model-driven Codex execution has not yet been filmed/verified.
See [workspace evidence and usage](docs/09-personal-workspaces.md).

## Register your own paid API or MCP tool

Sign in to your personal workspace, then open **Provide tools** (`/sell`).

1. Create a provider profile using a PERSONAL PayPal **sandbox** recipient email.
2. Register a public HTTPS JSON POST API or Streamable HTTP MCP tool you control.
   Set its object schema, description, price ($0.000001–$1 per success) and optional
   Bearer/X-API-Key secret. This release supports read-only, retry-safe operations.
3. Test a synthetic input, inspect the response, then publish the tool. The public
   catalogue and `/mcp` now advertise its stable provider-prefixed name and price.
4. Call it from a buyer MCP client with a fresh `_request_id` and the listed
   `_max_price_micro` (10000 for $0.01). It spends the buyer's credit and credits
   only this tool's author. A stale lower quote is rejected; failures cost zero.
5. In `/sell`, pay out whole-cent earnings and poll the same pending batch until
   both batch and item succeed. Production payments are disabled.

The page includes free invoice API/MCP endpoints for a reproducible example; they
run on this same backend. Registration does not host your code or make that public
example exclusive. Upstream arguments/results go to the selected service. Secrets
are encrypted; the private `DATABASE_PATH.upstream-key` file must be backed up with
the SQLite database. Endpoint/schema changes require a new registration; credential
replacement pauses the tool for retesting. Recipient ownership is not verified.

```sh
npm run verify:provider
```

This starts an isolated mock ledger, registers/tests/publishes both HTTP and MCP,
runs three paid calls, proves replay/failure charge zero, pays the new provider
$0.03, and matches both mock rail receipts. On Render, the installed Codex MCP client
also ran API → MCP → API; a real sandbox $0.03 payout succeeded and survived restart.
This is direct Codex transport verification, without a model turn. See [provider protocol and evidence](docs/10-provider-tools.md).

## Record the English demo

The [2:50 script](docs/01-demo-script.md), [voiceover](docs/demo-voiceover.txt),
[filming checklist](docs/08-recording-checklist.md) and
[English Devpost draft](devpost-submission.md) are prepared. Actual Chrome screen
footage has now been recorded and cut to a measured **170-second silent 1080p master**.
It includes provider registration, actual scripted Codex MCP receipts, mock payout/
reconciliation, real Gemini/Studio and a separate completed PayPal sandbox evidence scene.
The [presenter packet](docs/video/presenter-guide-ja.md) includes English copy and
an offline rehearsal player. Real presenter footage/narration, final composition,
public YouTube upload, judge access and the live Devpost form check remain open.

```sh
npm run verify:recording
npm run demo:record
```

The recording launcher needs a private Gemini key and active Grid/Studio licenses.
It prints a free loopback URL and creates a **fresh mock ledger for every take**,
even if `.env` points to the hosted sandbox archive. Sandbox payment credentials,
hosted origin and payout settings are overridden. Real Gemini is used only for
widget intent in this profile; the other AI surfaces stay deterministic. The
rehearsal and the final take never share a ledger. Stop a take with Ctrl-C and
launch again; files remain under ignored `data/recordings/` for inspection.

The no-key offline demo still uses `npm start` from a clean clone. When an existing
`.env` defines a hosted URL, explicitly override both origin and port for local use;
never open a sandbox archive as a mock database. `verify:recording` checks the
script's word/time budget, not the duration of an actual exported file.

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
PayPal approval-link fallback; server capture credits the ledger once, and a verified
webhook can recover a missed capture. Completed SDK v6 checkout was verified in
Google Chrome (SDK 6.70.0). The in-app browser could not open its approval popup.

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

To recheck an already completed application flow **without sending more funds**:

```sh
npm run verify:sandbox:ledger
```

This opens `DATABASE_PATH` read-only, validates ledger invariants, and fetches existing
Orders, Payouts and Transaction Search receipts. It never approves, captures or pays.
SDK v6 browser evidence is a separately recorded observation, not a CLI checkout.
Private raw evidence goes to `data/verification/{mock,sandbox}/latest.json`; the
read-only check writes `data/verification/sandbox/ledger-latest.json`.
Manual checks remain MANUAL; simulated passes never count as real PayPal passes.

## Sandbox verification — 2026-10-24

| Check | Local simulation | Actual PayPal sandbox evidence |
| --- | --- | --- |
| V1 Orders / capture / fee | PASS | **PASS**: completed $5.00 capture; fee $0.48, net $4.52 |
| V2 JS SDK v6 | Separate browser step | **PASS**: Google Chrome SDK 6.70.0 buyer approval and server capture |
| V3 webhook / signature | PASS for replay logic only | **PASS**: actual signed capture event accepted through public HTTPS; no double credit |
| V4 $0.03 payout | PASS; also exercised in browser | **PASS**: actual batch SUCCESS and item SUCCESS; author balance and reservation both zero |
| V5 Transaction Search | PASS; gross/fee/net match | **PASS**: capture and outgoing transaction reported; capture fee from Search, omitted payout fee independently verified by fresh Payouts GET |
| V6 PayPal Agent Toolkit | SKIP | SKIP: direct REST selected; Toolkit use is not claimed |
| V7 account reset | Local reset implemented | MANUAL: PayPal account reset not executed |

The initial payout failed with `INSUFFICIENT_FUNDS` and preserved author earnings.
Converting **JPY 1,000 of existing fake sandbox funds to USD 6.16** in the business
wallet resolved USD prefunding; a new payout succeeded. This is separate platform
test funding, not evidence that the captured $5 became available cash immediately.
The buyer received $5 credit, spent exactly $0.03 and retained $4.97. Actual fresh
API reads verified the capture and outgoing payout before delayed reporting arrived.
Both transactions now appear in Transaction Search with matching USD amounts and
successful status. Its payout row omits `fee_amount`; the displayed zero fee is
independently checked using fresh Payouts GET, with that source shown explicitly.
An absent transaction never becomes a reporting match. PayPal documents
[optional fee fields and reporting delay](https://developer.paypal.com/api/transaction-search/v1/schema.json).
See [actual sandbox evidence and restart instructions](docs/06-sandbox-evidence.md).

The persistent sandbox backend is now deployed on **Render**:
[Open AgentMeter sandbox](https://agentmeter-sandbox.onrender.com/app).
Personal registration starts at `/join`; the original operator screens require the
operator demo token. Financial records are sandbox test data; personal workspaces
have separate accounts and scoped access. The service uses Node 26.10.0, one Singapore instance
and a 1 GB persistent disk. Its reviewed base price is **$7.25/month** before any
additional usage or taxes. Auto-deploy and Blueprint Auto Sync are off.

The existing ledger was imported with checksum/invariant checks. The signed PayPal
Webhook now targets the Render backend; actual redelivery left balances unchanged.
After removing import variables, both a redeploy and **Restart service** retained
buyer $4.97, author $0, zero reservations, three live calls, API-key identities and
both reconciled receipts. A changed health process ID proves a new process started.
The old local sandbox writer and Quick Tunnel are stopped. Dotfield serves the
public information pages; the active sandbox ledger belongs to Render.

To repeat read-only checks, keep `DEMO_ACCESS_TOKEN` in local `.env` and run:

```sh
npm run verify:deployment -- --base https://agentmeter-sandbox.onrender.com --allow-pending-report
```

The original $4.97/three-call snapshot above is historical. The later provider
verification intentionally spent another $0.03: the buyer is now **$4.94**, the new
provider has a successful **$0.03** sandbox payout, and global reporting contains a
third rail receipt. Its fresh Payouts API check is VERIFIED; Transaction Search is
still pending. The opt-in flag preserves that distinction and never manufactures
a reporting MATCH. See [provider evidence](docs/10-provider-tools.md).

See [deployment and restart evidence](docs/07-hosting.md) for source and
before/after comparisons. The local `verify:sandbox:ledger` command checks the
frozen archive; it is not a query of the hosted database.

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
  Page agent run through Studio's Agent Framework. Licensed execution was verified
  locally and on Render in Chrome on 2026-10-24: exact receipt totals, monthly filters,
  delegation, task completion, and widget resizing. Intent interpretation uses Gemini
  when configured, with a validated rule-parser fallback. Without active licenses, the
  SSR table, CSV, rule-based widgets and local card layout work offline. Expired
  trials are omitted before rendering. Set `AG_GRID_LICENSE_KEY` (Grid + Charts
  bundle) and `AG_STUDIO_LICENSE_KEY` in ignored `.env` or private hosting settings.
  The current evaluation keys expire on 2026-11-23 and 2026-12-08 respectively.
  Keys are never committed. See [analytics verification](docs/04-analytics-verification.md).
- **Gemini 3.5 Flash-Lite**: REST structured output for validated widget intent,
  verified through actual API requests and Chrome Studio execution locally and on Render. Set private
  `GEMINI_API_KEY` and optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
  `npm run verify:ai` requires actual model success; the hosted form adds a ledger
  identity check. [Gemini verification](docs/05-gemini-verification.md) records the
  scope and prompts. Budget intent, narration and synthetic labeling adapters have
  unit coverage; their live model paths are not claimed as verified. Without a key
  or on model failure, deterministic fallbacks remain. Models cannot generate SQL,
  prices, tool execution or payouts.
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
  public information pages. **Render**: persistent sandbox Node backend, 1 GB SQLite
  disk, stable HTTPS, verified Webhooks and restart persistence.

## Ledger boundaries and hosting

All stored monetary values are safe integer micro-USD. `BigInt` intermediates avoid
floating-point arithmetic; only `microToPayPalAmount` produces PayPal decimal strings.
Reservations use SQLite `BEGIN IMMEDIATE`; retries replay the stored result. Monthly
spend includes active reservations. On startup, stale tool reservations are released;
this assumes one application process and local/read-only retry-safe upstream tools.
It does not promise exactly-once execution of arbitrary external side effects.
Pending payout reservations survive restart and must be polled/retried to resolve.

Consumer balance = captured credit − settled tool charges. Provider balance =
settled author credits − successful payouts. Author credit is currently 100% of the
call price; a platform fee can be enabled in the metering API. External funding fees
and payout fees are explicit expenses; they are not silently deducted from tool credit.
This prototype has no production seller identity checks, refunds or FX. Personal
recovery/session/key credentials persist as hashes in SQLite.

For hosting, use one Node process, `HOST=0.0.0.0`, `PORT` from the host, a backend
`PUBLIC_BASE_URL` (or `RENDER_EXTERNAL_URL`), and durable SQLite storage. Fast process
startup does not remove platform wake-up time. On Render free hosting, **the first
load may take up to a minute**, and filesystem changes are ephemeral. Use free
hosting only for an explicitly resettable mock demo. The deployed sandbox instead
uses the paid Render service and disk described above. See [hosting evidence](docs/07-hosting.md).

Public information: [project](https://dotfield.xyz/apps/agentmeter/),
[privacy](https://dotfield.xyz/apps/agentmeter/privacy/),
[terms](https://dotfield.xyz/apps/agentmeter/terms/),
[support](https://dotfield.xyz/apps/agentmeter/support/).

Design source: [decisions](docs/00-decisions.md). Submission draft:
[submission](docs/03-submission.md). Recording guide:
[demo script](docs/01-demo-script.md). License: [MIT](LICENSE).
