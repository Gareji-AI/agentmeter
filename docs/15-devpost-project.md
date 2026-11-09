# AgentMeter

Every agent tool call gets a price, a budget check, and a receipt.

## Inspiration

Useful agent tools can cost less than a conventional checkout makes practical.
Developers still need to cap an agent's spending, explain each charge, and pay the
people who publish useful tools. A payment receipt alone does not explain which
calls succeeded, which failed, or whether a retry charged twice.

AgentMeter was created during the hackathon to connect those pieces in one
inspectable workflow: prepaid tool credit, metered execution, provider earnings,
and payment reconciliation.

## What it does

A tool provider registers a read-only HTTPS API or Streamable HTTP MCP tool,
defines its schema and price, tests the connection, and publishes it. A buyer
funds a personal sandbox workspace, creates a revocable client key, and connects
an agent through MCP.

Before each tool call, AgentMeter reserves the quoted price and checks available
credit, the monthly cap, and the per-tool cap. Successful execution settles the
charge and credits the provider. Failure releases the hold. Reusing an
idempotency key returns the original receipt; a maximum-price argument prevents
silent price increases. Money is stored as integer micro-USD.

PayPal is the funding, payout, and reporting rail. Orders creates and captures
prepaid funding; Payouts transfers accumulated provider earnings; Transaction
Search provides independent reporting; verified webhooks recover payment events
without duplicate credit. Tool calls transfer internal credits rather than
creating a PayPal transaction for every cent.

## The working demo

The video follows one newly registered hosted invoice tool and its provider:

1. Register, test, and publish the tool at $0.01 per successful call.
2. One official Codex CLI invocation makes three MCP calls. The buyer's sandbox
   credit moves from $4.91 to $4.88, and this provider earns $0.03.
3. This provider receives an actual $0.03 PayPal sandbox payout. Both batch and
   item succeed; available and reserved earnings return to zero.
4. Fresh PayPal API reads verify that payout. Its Transaction Search report is
   still pending, which the interface labels separately from a confirmed match.
5. A natural-language analytics request creates a chart through Gemini and
   AG Studio agent delegation; a themed AG Grid presents exact money and states.

The CLI input-to-answer interval is continuous and at normal speed. The invoice
example is a free endpoint on the same backend; the demonstration is provider
metering, not proprietary OCR or invoice payment. All money is simulated or
PayPal sandbox test money. Analytics history is labeled synthetic.

Demo video: https://youtu.be/5jLyQqJBsPA

## How we built it

Node.js 26, built-in SQLite, native fetch, server-rendered HTML, and browser ES
modules provide the application with zero npm runtime dependencies and no build
step. SQLite transactions make reservation, execution settlement, and retry
identity inspectable. The sandbox backend runs on Render with a persistent disk.

Gemini 3.5 Flash-Lite converts an analytics question into a constrained intent:
metric, grouping, period, and optional tool. The server validates each field
before chart creation. Rules remain available when inference is unavailable.
Models do not set prices or approve PayPal transfers.

Our custom metering analyst uses AG Studio's Agent Framework to delegate to its
Page agent definition. Our custom runner invokes the Page agent's `add_widget`
and `complete_task` tools, with delegation and hand-back visible in chat. The
workspace combines a forest theme, a custom exact-USD receipt widget, editable
layout, and AG Grid custom money/status cells.

Codex supported ledger and HTTP implementation, tests, browser verification,
deployment, and evidence-driven iteration. The APIMatic Context Plugin for PayPal
guided source inspection and error-handling review. Native REST remains the
runtime integration. We checked actual sandbox API responses and browser outcomes
instead of treating generated code as proof of integration.

## Challenges and what we learned

A successful result, internal credit, and cash received are different things.
In a completed sandbox run, a $5 capture had a $0.48 fee and $4.52 net cash while
the buyer received $5 of tool credit; the platform absorbs funding fees. Payout
liquidity also needed separate sandbox prefunding.

A timeout is different from a failed transfer. Unresolved payouts retain their
reservation and external identity so a retry cannot silently create a second
transfer. Transaction Search can lag; a fresh Payouts item read verifies an
outgoing fee with an explicit source, while missing reports stay pending.

The most useful AI lesson was to give the model a bounded task and validate its
output. The filmed Codex task executes three requested tools under a three-cent
allowance, while analytics inference selects only allowed read-only fields.
Deterministic server checks enforce the financial rules.

## Accomplishments

- A complete funding → metered call → earnings → payout → reconciliation loop.
- Personal buyer/provider workspaces, hash-stored credentials, scoped receipts,
  revocation, and server-enforced spending caps.
- A real Codex tool run and a real Gemini/Studio analytics workflow.
- An offline mock demonstration that needs no accounts, keys, or network.
- 82 passing tests, including cross-connection reservations, replay conflicts,
  failed-call release, forged receipts, ambiguous payouts, MCP behavior, safe
  rendering, and workspace isolation.

## Try it

Source and setup: https://github.com/Gareji-AI/agentmeter

With Node.js 26 or later:

```sh
git clone https://github.com/Gareji-AI/agentmeter.git
cd agentmeter
npm test
npm run verify:demo
npm start
```

On a clean clone, open http://localhost:8787. No `.env`, package install,
payment credentials, or network access is needed for the mock money loop. Run
three buyer calls ($5 → $4.97), try a failure, open Provider and pay out $0.03,
then open Reconciliation to see two simulated matches. Analytics retains a plain
table, CSV export, and rule-based widgets without external keys or licenses.

Hosted personal sandbox entry: https://agentmeter-sandbox.onrender.com/join

Create your own zero-credit workspace and save the one-time recovery code.
Actual hosted funding requires your own PayPal sandbox buyer account; provider
payouts require a sandbox recipient. Use the local mock to test the whole loop
without those accounts. Operator evidence screens require separate operator
access; no operator token is published.

## Limitations and next steps

This prototype supports sandbox/simulated funds only and rejects production
PayPal hosts. Provider tools must be read-only and retry-safe. It does not host
provider code or verify ownership of a sandbox recipient email. Recovery codes
have no email recovery. SQLite is single-instance; production seller onboarding,
refunds, FX, and high availability remain future work.

The optional Grid/Charts trial expires November 23, 2026, and the Studio trial
expires December 8, 2026. Expired keys are suppressed, and the table, CSV, and
rule-based analytics fallback remain usable. Gemini/CDN availability and quotas
can affect optional analytics; the offline mock remains reproducible.
