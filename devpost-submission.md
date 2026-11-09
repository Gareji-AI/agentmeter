# AgentMeter — submission review package

Status: not submitted. The official Devpost form, requirements, rules, registration,
and dates were read on 2026-11-09. The existing empty project is 1536626.
The final public video and project thumbnail are prepared. The participant has
authorized public repository release; final rules review and submission approval
remain pending. The concise project story to be uploaded is
[docs/15-devpost-project.md](docs/15-devpost-project.md). The longer notes below
retain the build evidence and historical preparation context.

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
The six built-in tools are deterministic and run without a model or network access.
Providers can also register read-only HTTPS APIs or Streamable HTTP MCP tools with
a schema and price, test the connection, then publish. Buyer calls reserve the
agreed price, invoke the service, and credit that tool’s author only on success.
A maximum-price argument prevents silent price increases. Providers manage their
own sandbox payouts in a separate account.

A personal sandbox workspace lets a buyer sign up with a nickname, save a one-time
recovery code, fund their own credit, issue/revoke client keys and copy Codex MCP
settings. Their receipts and spending limit are separate from the operator demo.
New credentials are hash-stored; client keys authorize tools, not console administration.

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

Models do not set prices or approve PayPal transfers. A filmed Codex model run
requests three hosted tool calls; deterministic gateway checks reserve and settle
their charges. A local capture gateway binds three approved inputs to stable
execution IDs and a one-cent price cap. The offline buyer plan remains scripted.
Other Gemini adapters exist, but live budget,
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
- Personal buyer signup, recovery-code sign-in, hash-stored client keys, revocation and scoped receipts.
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
- Personal sandbox entry: https://agentmeter-sandbox.onrender.com/join — create your own zero-credit workspace.
- Operator evidence screens: https://agentmeter-sandbox.onrender.com — operator access required.
  Arrange that access privately; never publish tokens.
- Local mock: complete reproduction instructions above; no payment credentials needed.

## Public Repository Link

https://github.com/Gareji-AI/agentmeter — public release authorized by the owner on
2026-11-09 after a committed-history credential-pattern audit. MIT license is present.
Live public visibility must be confirmed before submitting.

## Demo Video

YouTube URL: https://youtu.be/5jLyQqJBsPA — publicly uploaded on 2026-11-09.
Final presenter composition: `agentmeter-final-v2.mp4`, measured 168.533 seconds,
1920×1080, H.264/AAC. Presenter face appears during the introduction and close;
demonstration screens remain unobstructed. YouTube copyright checks found no issues.

Historical source/edit record follows:
A completely new Chrome recording is edited to a measured **162-second (2:42)
silent 1080p master**. The filmed flow uses one new provider and its own newly
registered invoice tool: 0:00 introduction; 0:06 registration/test/publication;
0:36 buyer selects the one-cent tool; 0:46 real official Codex CLI prompt → three
MCP calls → invoice table; 1:12 actual buyer balance $4.91 → $4.88; 1:22 the same
provider's $0.03 earnings → actual sandbox payout SUCCESS; 1:44 this payout's fresh
PayPal API verification and pending Search report; 2:00 fresh Gemini/Studio and
themed Grid; 2:36 close. No old or mock payout shot is reused. The CLI's actual
stdout/stderr is streamed into a privacy-filtered Chrome terminal; its 26-second
input-to-answer interval is continuous, at normal speed, in one invocation.
English narration and shot actions: `docs/01-demo-script.md`.

A local 2026-10-25 provisional edit adds English captions, restrained chapter
motion made through Open Design MCP, a replaceable generic synthetic narrator,
and an original score/effects synthesized locally with Earshot 0.4.0. It is still
162 seconds. The participant's own face/voice will replace the rehearsal voice;
the film has not been publicly uploaded. See `docs/14-narrated-demo-edit.md`.

## Screenshot Shot List

Capture app-only English images after checking for private data:

1. Hosted buyer: $4.8800 available and three settled calls for the newly registered tool.
2. Same fresh provider: successful $0.0300 PayPal sandbox payout and zero available/reserved earnings.
3. Analytics: Gemini source/model, Page-agent delegation/hand-back, custom receipt and chart.
4. Themed Grid: custom USD and state cells beside the Studio layout.
5. Same payout in hosted Reconciliation: fresh API VERIFIED, Search PENDING_REPORT; fee sources and sandbox badge.

## Submission Readiness Notes

Local English copy, timed voiceover, fresh-take launcher and recording checklist
are prepared. Chrome rehearsals verified the money loop and actual Gemini/Studio
path. Recorded sandbox evidence covers SDK v6 approval, $5 capture, three $0.01
calls, $0.03 successful payout, signed webhook replay, both Search matches and
unchanged ledger identities after service restart. Raw evidence stays Git-ignored.
The silent master and a narrated provisional composition exist; real presenter
footage and the final presenter composition remain open. The live form has not
been checked in this pass.

## Known Limitations

Sandbox/simulated funds only; production PayPal hosts are rejected. The business
sandbox wallet needed USD prefunding before payout; capture does not prove immediate
payout liquidity. Transaction Search can lag and omits the outgoing fee; a fresh
Payouts item read verifies it with an explicit source. Missing reports stay pending.
Analytics includes labeled synthetic history. Single-instance SQLite is a prototype;
refunds, FX, high availability and production seller onboarding are future work.
Provider registration supports read-only retry-safe APIs/MCP tools; it does not
host code or verify ownership of the sandbox recipient email. Personal buyer workspaces have no email recovery; save the recovery code.
Grid/Charts trial expires 2026-11-23 and Studio trial 2026-12-08; the application
suppresses expired keys and retains its fallback. Gemini/CDN availability and
free-tier quotas can affect optional analytics. Use synthetic model questions.

## Current Official Form Preparation

Official requirements and all 22 questions were read through Devpost on 2026-11-09.
Registration is already complete; the existing project has no submitted_at value.
The participant confirmed individual entry, Japan, eligibility attestations,
permission for feedback contact, PayPal experience 10/10, significant learning,
and useful career value from AI. Narrative feedback is drafted from recorded build
experience. Used sponsor tools: AG Grid, APIMatic, Render; AG Grid remains the
primary presentation emphasis. No additional opt-in prize IDs are assumed.

The submission includes the public video, source repository, hosted personal
sandbox entry, and complete offline testing instructions. A generated cover built
around the actual analytics screen was uploaded as the project's thumbnail.
Final rules review and the real-submit confirmation are still required.

## Verified provider demonstration

A fresh hosted provider registers, probes and publishes its invoice API at $0.01.
One installed Codex CLI invocation makes exactly three successful MCP requests;
the buyer's existing sandbox credit moves from $4.91 to $4.88, and that provider
earns $0.03. The provider then pays out this new $0.03 through actual PayPal sandbox
Payouts. Batch and item both succeed, leaving zero available and reserved earnings.
Fresh PayPal reads verify the outgoing amount; its Search report remains pending,
while three earlier payment-rail records match. The same tool name connects the
registration, CLI task, buyer receipts, author earnings and Grid row.

Chrome streams the official CLI's actual stdout/stderr with private fields redacted.
The input-to-answer interval is continuous and at normal speed, in one invocation.
Fresh Gemini/Studio and themed Grid footage complete the all-new recording. The
analytics session preserves the hosted ledger identity. Earlier automated proofs
also cover replay/failure charge zero, API plus MCP upstreams and restart persistence.
Both supplied invoice examples are free public endpoints on this same backend;
this demonstrates provider metering, not proprietary OCR or invoice payment.
See `docs/10-provider-tools.md` and `docs/13-full-demo-retake.md`.
