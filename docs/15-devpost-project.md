## Inspiration

I built AgentMeter for developers who want to charge for tools used by AI agents. A provider sets a price for each call; the buyer sets a spending limit and gets a record of what ran and what it cost.

For a one-cent tool, I wanted to collect payment through prepaid credit, then pay the provider's accumulated earnings. The difficult part was keeping that credit, each tool result, and the PayPal records in agreement.

I started the project during this hackathon. It currently uses PayPal sandbox funds only.

## What it does

A provider registers an HTTPS API or MCP tool, sets its price, tests it, and publishes it. A buyer adds sandbox credit, creates a client key, and connects an MCP client such as Codex. The prototype accepts read-only, retry-safe tools.

Before running a request, AgentMeter checks the quoted price, available credit, and spending limits. It reserves the charge while the tool runs, then debits the buyer and credits the provider when the request completes.

If the request fails, the reservation is released. Retrying a completed call with the same request ID and arguments returns the saved result without another charge. A call above the client's maximum price is rejected.

PayPal handles three parts of the workflow:

- **Funding:** Orders creates and captures a prepaid top-up, with buyer approval through the PayPal JavaScript SDK v6.
- **Provider payouts:** Payouts sends accumulated earnings to a sandbox recipient.
- **Reconciliation:** Transaction Search checks the payment records against the ledger. Separate Orders and Payouts reads verify receipts, and verified capture webhooks avoid duplicate credit.

A one-cent tool call moves internal credit. It does not create a separate PayPal payment. The interface shows credit balances, payout status, fees, and reporting results separately.

## How I built it

The server uses Node.js 26, built-in SQLite, and native fetch. Pages use server-rendered HTML and browser JavaScript. The core mock has no npm dependencies or build step. The hosted backend runs on Render with a persistent disk.

Ledger amounts are integer micro-USD. SQLite transactions reserve credit before an upstream request and settle or release it afterward. Saved request IDs link retries to the original call.

The recorded Codex CLI run uses gpt-6.1-sol to call a provider's tool three times over MCP. A capture gateway restricts it to three approved inputs and a one-cent maximum per call. Server checks enforce those limits.

For analytics, Gemini 3.5 Flash-Lite interprets questions such as “Plot what I paid each calendar day during the current month.” The server checks its choice of metric, grouping, period, and tool before returning data for the chart.

AG Studio supplies the editable dashboard. I added a receipt widget, a forest theme, and AG Grid cells for USD amounts and call status. Charts can be created from a question, then moved or resized in the layout.

My metering analyst delegates chart creation through Studio's Agent Framework. I supply the runner for the Page agent's tools; Gemini supplies the validated intent. The chat shows delegation and completion.

Codex helped implement the ledger, HTTP routes, tests, and deployment checks. I used the APIMatic Context Plugin for PayPal to inspect SDK source and review error handling. The server calls PayPal REST APIs directly.

## Challenges I ran into

My first sandbox payout attempts failed because the business wallet needed USD funding. Capturing a buyer's top-up did not prove the wallet could immediately pay a provider. I funded the sandbox wallet separately and repeated the payout.

Fees made buyer credit and cash receipts diverge. In one sandbox capture, the buyer received $5 of credit while PayPal reported a $0.48 fee and $4.52 net. The platform absorbs that funding fee.

Reporting can also lag. In the recorded demo, PayPal confirmed the new payout before it appeared in Transaction Search. I kept the report marked pending and showed the API verification separately.

A lost response needed different handling from a rejected payout. When the outcome is uncertain, AgentMeter keeps the reservation and external request identity for recovery. It does not assume the transfer failed and start a new one.

## Accomplishments that I'm proud of

The video follows one provider from tool registration to a successful sandbox payout. One Codex CLI run makes three $0.01 calls: buyer credit falls from $4.91 to $4.88, and that provider earns and receives $0.03.

Those calls use existing prepaid credit; the video does not show another top-up. The invoice tool is a free example endpoint on this backend, used to demonstrate metering. It reads sample invoice text and does not pay invoices.

The CLI input-to-answer sequence plays continuously at normal speed. The analytics section shows a real Gemini request, Studio delegation, and a chart. Historical analytics are labeled synthetic and are separate from the buyer's balance.

I also kept a complete offline mock for testing. All 85 tests pass, including concurrent reservations, repeated requests, failed calls, mismatched payment receipts, ambiguous payouts, and isolation between buyer workspaces.

[Watch the 2:48.5 demo](https://youtu.be/5jLyQqJBsPA).

## What I learned

I gave Codex a bounded tool task and Gemini a small set of chart fields. The server still checked prices, balances, and permitted inputs. I could test those checks without asking a model to decide whether a charge was allowed.

I learned to check a payment beyond its success response. A tool result, buyer credit, provider earnings, and an external payment record describe different events. Recording them separately helped me find mistakes in the flow.

## What's next

I would work on provider verification and refunds before attempting production payments. The current design also needs a storage plan beyond a single SQLite instance. Funding fees need a sustainable pricing policy before real-money use.

## Try it

[Source code and README](https://github.com/Gareji-AI/agentmeter) · MIT license.

Install Node.js 26 or later, then download the repository:

```sh
git clone https://github.com/Gareji-AI/agentmeter.git
cd agentmeter
npm test
npm run verify:demo
npm start
```

Open http://localhost:8787. After cloning, the mock runs offline without a `.env` file, payment credentials, or `npm install`.

Run three buyer calls to move $5 of simulated credit to $4.97. Try a failed call, then open Provider and pay out the $0.03 earnings. Reconciliation shows two simulated matches. No real money moves.

The mock has a table, CSV export, and rule-based analytics without keys. Studio can run in watermarked evaluation mode; Gemini intent needs a Gemini key. The README covers both setups.

[Hosted sandbox](https://agentmeter-sandbox.onrender.com/join): create a zero-credit workspace and save the recovery code. Funding needs your own PayPal sandbox buyer account; payouts need a sandbox recipient. The local mock needs neither.

## Current limits

Production PayPal hosts are disabled. The prototype does not host provider code or verify ownership of a provider's sandbox recipient email. Recovery codes have no email recovery. Operator analytics require separate operator access.

The Grid/Charts trial ends November 23, 2026; Studio ends December 8. After expiry, analytics use the vendor's watermarked evaluation mode, which the AG Grid team permits for this hackathon. The plain table remains available as a fallback.
