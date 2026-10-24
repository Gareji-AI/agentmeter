# AgentMeter — final local English draft

Status: draft only. Nothing has been sent to Devpost. Prepared from implemented
behavior and recorded verification on 2026-10-24. Devpost authentication was
unavailable in this pass; headings below organize the copy and are not a claim
about the current official form. Final video and judge-access checks remain open.

## Title

AgentMeter

## One-line Summary

Every agent tool call gets a price, a budget check, and a receipt.

## Problem

Small tool calls can cost less than a conventional checkout makes practical.
Developers need to limit an agent's spending, explain each charge, and pay the
people who publish useful tools. A payment receipt alone does not explain which
calls succeeded, which failed, or whether a retry charged twice.

## Solution

AgentMeter connects prepaid tool credit, metered execution, author earnings and
payment reporting in one inspectable ledger. It reserves the price before a call,
settles successful execution, and releases the hold when a tool fails. A repeated
idempotency key reuses the receipt. Monthly and per-tool caps include reservations.

The demo starts with $5 of simulated credit. Three scripted one-cent calls leave
$4.97 and credit the author $0.03. A failed call costs nothing. The author requests
a payout, then reconciliation compares the ledger against the selected payment rail.
The six metered tools are deterministic and run without a model or network access.

PayPal is the funding, payout and reporting rail. Orders creates and captures
prepaid funding; Payouts transfers accumulated author earnings; Transaction Search
provides independent reporting; verified webhooks recover events without duplicate
credit. Tool calls transfer internal credits, rather than creating a PayPal
transaction for every cent.

## Why This Matters

A useful result, an internal credit and cash received are different things.
AgentMeter makes those distinctions visible. In the completed sandbox run, the
$5 capture had a $0.48 fee and $4.52 net cash, while the buyer received $5 of tool
credit. The platform absorbs funding fees. A timeout is also different from a
failed transfer: unresolved payouts keep their reservation and external identity.

## How We Used AI

Gemini 3.5 Flash-Lite turns a usage question into a constrained analytics intent:
metric, grouping, period and optional tool. The server validates each field before
chart creation. The paraphrase “Plot what I paid each calendar day during the
current month” was verified with the actual model, locally and on Render; the
ledger stayed unchanged. Rules remain available when inference is unavailable.

Our custom metering analyst uses AG Studio's Agent Framework to delegate to the
shipped Page agent definition, with our custom runner invoking its `add_widget`
and `complete_task` tools. The visible chat records delegation and hand-back.
The workspace combines a forest theme, a custom exact-USD receipt widget, editable
layout and AG Grid custom money/status cells. It is a working analytics workflow.

Models never select prices, approve transfers or change balances. The buyer's
three-call plan is scripted. Other Gemini adapters exist, but live budget,
narration and classification inference are not represented as verified; the
recording profile uses deterministic behavior for those paths.

## How We Used Codex

Codex supported ledger and HTTP implementation, test creation, browser verification,
deployment and evidence-driven iteration. The APIMatic Context Plugin for PayPal
guided source inspection and error-handling review; native REST remains the runtime.
For example, optional fee/net fields and ambiguous payout transport failures informed
the reconciliation and reservation behavior. We checked actual sandbox API responses
and Chrome outcomes instead of treating generated code as proof of integration.

## Key Features

- Reserve → execute → settle/release, exact integer micro-USD accounting and replay-safe receipts.
- MCP Streamable HTTP tools with budget enforcement and insufficient-credit top-up links.
- PayPal sandbox funding, verified webhook deduplication, author payouts and reconciliation.
- Real Gemini intent → custom Studio analyst → Page agent → chart, with source labels.
- Themed Grid, custom receipt and cells, editable layout; plain table, CSV and rule widgets survive missing/expired licenses.

## Architecture

Node.js 26, built-in `node:sqlite`, native fetch, server-rendered HTML and browser
ES modules. Zero npm runtime dependencies and no build step. Financial arithmetic
uses integers; the PayPal decimal boundary is explicit. The sandbox backend runs
on Render with a persistent SQLite disk and operator-token access. Dotfield hosts
English project/privacy/terms/support information. Optional AG libraries load from
pinned CDN versions only when licensed; Gemini API credentials remain server-side.

## Testing Instructions

With repository access and Node 26+, run:

```sh
git clone https://github.com/Gareji-AI/agentmeter.git
cd agentmeter
npm test
npm run verify:demo
npm run verify:recording
npm start
```

A clean clone needs no `.env`, accounts, network or `npm install` for the complete
mock money loop. Open http://localhost:8787, run the three-call demo, try a failure,
open Provider and pay out, then open Reconciliation: two simulated matches.
Analytics retains a plain table, CSV and rule-based widgets without external keys.

For the real-model/Studio recording, configure a private Gemini key and active
AG licenses, then run `npm run demo:record`. Its printed Chrome URL uses a fresh
isolated mock ledger. Submit the prepared paraphrase in Studio's AI Assistant.
Expect a Gemini source/model label, Page-agent delegation, hand-back and chart.
The custom receipt includes synthetic history; it is not the buyer balance.

Automated coverage includes two-connection reservations, replay conflicts,
exhaustion, caps, release/rollback, forged payment receipts, ambiguous payouts,
MCP behavior, safe rendering, analytics session completion and recording isolation.
See README and the evidence documents for reproducible verification boundaries.

## Public Demo Link

- Information: https://dotfield.xyz/apps/agentmeter/
- Running sandbox: https://agentmeter-sandbox.onrender.com — operator access required.
  Arrange access through an appropriate private judge channel; never publish tokens.
- Local mock: complete reproduction instructions above; no payment credentials needed.

## Public Repository Link

https://github.com/Gareji-AI/agentmeter — currently private. Judge access or an
explicitly approved public release must be arranged before delivery. MIT license.

## Demo Video

YouTube URL: **pending actual recording, export inspection and public upload**.
Prepared outline: 0:00 buyer; 0:12 three calls; 0:33 failure; 0:47 payout;
1:04 mock reconciliation; 1:22 real Gemini/Studio; 2:06 layout/Grid;
2:25 separate completed sandbox reconciliation; 2:42 close; end at 2:50.
English narration and shot actions: `docs/01-demo-script.md`.

## Screenshot Shot List

Capture app-only English images after checking for private data:

1. Buyer: $4.9700 available, three settled calls, zero-charge released receipt and MOCK badge.
2. Provider: $0.0300 successful mock payout and zero remaining author earnings.
3. Analytics: Gemini source/model, Page-agent delegation/hand-back, custom receipt and chart.
4. Themed Grid: custom USD and state cells beside the Studio layout.
5. Separate hosted sandbox Reconciliation: two MATCH rows, fee sources and sandbox badge.

## Submission Readiness Notes

Local English copy, timed voiceover, fresh-take launcher and recording checklist
are prepared. Chrome rehearsals verified the money loop and actual Gemini/Studio
path. Recorded sandbox evidence covers SDK v6 approval, $5 capture, three $0.01
calls, $0.03 successful payout, signed webhook replay, both Search matches and
unchanged ledger identities after service restart. Raw evidence stays Git-ignored.
This packet does not assert that a video has been made or that the live form was checked.

## Known Limitations

Sandbox/simulated funds only; production PayPal hosts are rejected. The business
sandbox wallet needed USD prefunding before payout; capture does not prove immediate
payout liquidity. Transaction Search can lag and omits the outgoing fee; a fresh
Payouts item read verifies it with an explicit source. Missing reports stay pending.
Analytics includes labeled synthetic history. Single-instance SQLite is a prototype;
refunds, FX, high availability and production onboarding are future work.
Grid/Charts trial expires 2026-11-23 and Studio trial 2026-12-08; the application
suppresses expired keys and retains its fallback. Gemini/CDN availability and
free-tier quotas can affect optional analytics. Use synthetic model questions.

## TODO Official Form Fields

Reconnect Devpost to read the actual requirements, criteria, dates and questions.
Map this copy to those fields, check any length limits and confirm the intended
single sponsor target (AG Grid). Add the real public video URL, arrange code/demo
access and review required acknowledgments. No registration, rule acknowledgment,
team membership or form-specific answer is inferred here.
