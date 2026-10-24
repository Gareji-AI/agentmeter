# Submission Notes & Prize Strategy

Source: `paypalaihackathon.devpost.com/resources`, `/details/faqs`, and each
`/details/<sponsor>` page, read 2026-10-24. Recorded here because the submission form
asks which tools were used and how, and because the prize rules are not guessable.

## 1. Eligibility (Japan confirmed)

- Above legal age of majority, all countries except the standard exclusions.
- Explicitly excluded: **Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea**, and any
  OFAC-comprehensively-sanctioned territory. Applies to every team member.
- **No maximum team size.** Solo entry is fine.
- A PayPal account is not required for eligibility; the sandbox is free. If sign-up is
  unavailable in a region, PayPal asks you to raise it on Discord — a separate concern
  from eligibility.

## 2. Prize stacking rule (this drives the whole plan)

> A project can win **at most one (1) Grand Prize and one (1) Sponsor Prize**, or
> **one (1) Honorable Mention Prize and one (1) Sponsor Prize**.

Consequences for AgentMeter:

- Target **one** sponsor prize, not several. Being considered for several is automatic if
  the tool is used, but only one can be won, so optimise for the one with the best
  odds-per-hour.
- Grand/Honorable is chosen by the judges from the same submission; there is no separate
  entry for it. So the *core* submission must stand on the five equally-weighted criteria
  regardless of the sponsor play.

## 3. Sponsor decision

| Sponsor | Top award | Places | Effort for AgentMeter | Verdict |
|---|---|---|---|---|
| **AG Grid** | $5,000 | 3 ($5k/$2k/$1k) | Medium. Needs a dense analytics surface + theming, not just a grid. | **Primary play** |
| Bryntum | $1,000 | 3 | High. Needs Gantt/Scheduler/Calendar as the product's spine. | Pass — same effort, 5× less upside |
| Channel3 | $1,500 | 1 | Medium. Needs a real product-search call path. | Optional garnish |
| APIMatic | $1,000 + 6mo Business | 3 | **Low — and pays out even without winning** | **Do it** (see §4) |
| Render | Credits only | 3 | Optional backend host; not deployed | Optional |
| Elastic / KERNEL / Astropods / Postman / Zapier | various | — | High, orthogonal | Pass |

**Rationale for AG Grid over Bryntum.** Bryntum's own suggested idea — "Subscription
revenue radar: one row per customer account, showing billing periods, expected renewals,
and failed payment markers + refunds" — is a near-exact description of AgentMeter's
ledger, which makes it tempting. But the Bryntum top prize is $1,000 against AG Grid's
$5,000, for comparable work. AG Grid also ships three winning places instead of one.

AG Grid requirements to satisfy explicitly (from `/details/aggrid`):

- "covers both what your dashboard looks like **and how you build it**"
- "custom widgets, **theming**, and layout tools, **not just AG Grid or AG Charts on their own**"
- Studio Agent Framework: a custom agent talking to Studio's built-in agents

So the AG Grid surface must be a **themed analytics view with at least one custom cell
renderer and a natural-language → widget path**, not a `<AgGridReact/>` with CSV export.
Free 45-day trial licence covers the build window. Starter repo:
`github.com/paypaldev/hackathon-paypal-ag-grid`.

## 4. APIMatic: a prize that pays out without winning

From `/details/apimatic`: using the **APIMatic Context Plugin for PayPal** in an AI coding
agent entitles the participant to **1 month of APIMatic Basic free**, and winning teams get
6 months of Business. There is a claim form on the page.

Practical action: install the Context Plugin, build the PayPal integration with it, and
**record that in the README and the "Tools" section**. It costs an afternoon at most, it
is independently rewarded, and it strengthens the "how you used AI" answer with something
concrete instead of a claim.

## 5. Confirmed free credit / access inventory

| Sponsor | What | How |
|---|---|---|
| Render | $50 credits | `https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon` |
| AG Grid | 45-day trial licence | `/studio/license-pricing/` |
| APIMatic | 1 month Basic (Context Plugin use) | claim form on `/details/apimatic` |
| Channel3 | 20,000 API credits | promo code `PAYPAL-HACKATHON-2026` at `trychannel3.com/developers` |
| Elastic | 14-day trial, self-extend +30 | `ela.st/elastic-paypal-hackathon` |
| KERNEL | $50 credits | code `KERNELDEVPOST2026` |
| Bryntum | 45-day trial | `bryntum.com/download` |
| Zapier | 14-day Pro trial (has a PayPal action) | `zapier.com/sign-up` |
| Astropods | free tier | `astropods.com` |
| Discord | PayPal hackathon server | `discord.gg/sJ2G6DyvSK` |

AG Grid is the sponsor target; a Render deployment is optional, not yet provisioned. The rest are recorded so nobody
re-researches them.

## 6. PayPal's own "Inspiration" list — direct hit

The resources page names, under *AI Agents or Automation*:

> "two agents negotiating and settling a payment between themselves (**agent-to-agent
> commerce**)"

and under *Business Solutions*:

> "a marketplace checkout flow that **splits payment automatically between a platform and
> its sellers**"

AgentMeter is both of those at once: a metered, agent-to-agent payment rail that splits
each call's price between the platform and the tool author. **Quote these two lines in the
submission text.** It is the cheapest possible evidence that the project is on-brief.

Also confirmed as first-class docs the judges will recognise:
PayPal JavaScript SDK v6, REST API, Payouts, Disputes, Subscriptions, Invoicing, Webhooks,
PayPal MCP server quickstart, Agent tools reference, `github.com/paypal/AI-Toolkit`.

## 7. English submission draft — implemented scope

**Title:** AgentMeter

**Tagline:** Every agent tool call gets a price, a budget check, and a receipt.

**Problem and audience:** Developers publishing small AI tools need usage accounting
that works below a conventional checkout's useful granularity. Agent developers need
to bound spending and explain what each result cost. AgentMeter brings both sides
into one inspectable ledger.

**What it does:** A consumer prepays tool credit, an agent calls deterministic tools,
and AgentMeter reserves, executes, then settles or releases each charge. A repeated
request replays its result rather than charging again. Monthly caps include reserved
funds. Authors accumulate earnings and request a payout. A separate reconciliation
screen compares ledger entries with external receipts and exposes fees.

**Why PayPal is central:** Orders creates and captures prepaid funding; Payouts sends
accumulated author earnings; Transaction Search supplies the independent comparison;
verified webhooks provide an idempotent event path. PayPal is the funding and payout
rail, rather than a decorative checkout beside an unrelated application.

**What is proven:** A local simulation runs with Node 26 and `npm start`, without a
package install or credentials. Actual PayPal sandbox verification also completed:
SDK v6 buyer approval, $5.00 capture, three $0.01 calls, $4.97 remaining buyer credit,
$0.03 author earnings and a successful Payouts batch and item. A signed Webhook
arrived through public HTTPS and did not duplicate the credit. Fresh Orders/Payouts
API reads agree with both ledger receipts. Transaction Search subsequently reported
both matching transactions; the omitted outgoing fee is independently verified with
a fresh Payouts item receipt. Sandbox funds are test funds only.

**Actual sandbox limitations:** Search omits the outgoing payout fee. A fresh Payouts
GET verifies it with its source shown explicitly, while the capture fee comes from
Search. Missing reporting transactions still remain pending. The $5 capture had a $0.48 fee and $4.52 net cash. The platform absorbs
funding fees; tool credit is not cash received. An initial payout was rejected for
insufficient USD funds, preserving author earnings. Converting JPY 1,000 of existing
fake sandbox funds to USD 6.16 prefunded the business wallet before successful
payout. The public backend is a temporary tunnel to a local Mac, not durable hosting.

**Tools used:** Native Node.js 26, `node:sqlite`, native fetch, `node:test`; PayPal Orders,
Payouts, Transaction Search, Webhook Verification REST and optional JS SDK v6 approval;
MCP Streamable HTTP; Codex; APIMatic Context Plugin for PayPal as a source-grounded
coding reference (native REST remains the runtime). Dotfield/Cloudflare hosts public
information pages and a temporary tunnel to the local backend. Render is not deployed.

**Optional AI and analytics:** Gemini adapters for constrained intent, narration and
synthetic labels are implemented, with deterministic fallbacks. No Gemini key has
been supplied: real model use is not yet verified. AG Grid 36.2.0 and AG Studio 3.0.0
adapters implement theming, custom cells, a receipt widget, layout and a custom Studio
agent delegating to the built-in page agent. No license has been supplied: successful
licensed execution and AG Grid sponsor readiness remain pending. The offline analytics
table, CSV and rule-driven widgets are working. Do not submit optional integrations
as verified until they are exercised.

**What we learned:** A timeout is not a failed transfer. Unresolved payout requests
must retain their reservation and external identity. Tool prices and budget decisions
must use exact integers, while external fees and capture receipts remain distinct
from purchased tool credit.

**Next:** Complete durable hosting, verify licensed Studio and optional Gemini,
then record the English video. Durable
hosting, refunds, FX and production account onboarding are future work.

Copy this draft only after updating it against the final evidence. See README for the
full Tools inventory and `01-demo-script.md` for the under-three-minute recording plan.

## 8. Submission checklist (tick at submit time)

- [ ] Repository public, **LICENSE visible in the About section**
- [x] README: English, setup + run instructions that work on a clean machine
- [x] README: "Tools" section naming every model/API and what it does
- [x] README: sandbox verification result table filled in (including pending/failed checks)
- [ ] Working demo reachable (hosted URL **or** reproducible local run — both for us)
- [x] English description draft: problem, audience, PayPal integration and limitations
- [ ] Demo video < 3:00, uploaded to YouTube, public, link on the form
- [ ] Video shows the app running on the device it was built for
- [ ] Video contains no third-party trademarks or copyrighted music
- [ ] Every material is English
- [ ] `PAYOUT_MODE` and mock/live mode stated honestly anywhere money appears

## 9. Risks recorded from the sponsor pages

- AG Grid trial is 45 days and the hackathon ends 2026-11-12 — the trial expires after the
  judging period, so the hosted demo must keep working. Mitigation: the `/grid` view
  degrades to a plain HTML table when the AG Grid licence is absent, and the README says so.
- Render free instances sleep. A judge clicking a cold URL and waiting 50 seconds is a
  Design score risk. Mitigation: keep the app's cold start under a second with no heavy
  imports, and say "first load may take up to a minute" in the README.

## 10. Public website and information URLs

Use the English AgentMeter pages on Dotfield for public project information:

- Website: https://dotfield.xyz/apps/agentmeter/
- Privacy: https://dotfield.xyz/apps/agentmeter/privacy/
- Terms: https://dotfield.xyz/apps/agentmeter/terms/
- Support: https://dotfield.xyz/apps/agentmeter/support/

The website is an information page, not a working demo. Supply a separately
verified application URL in any submission field asking for an interactive demo.
Webhook delivery also needs the deployed backend's HTTPS endpoint; the static
Dotfield pages cannot receive or verify PayPal events. Keep payment credentials
out of Dotfield source and static assets.

Hosting clarification: fast Node startup does not remove Render's platform
spin-up delay. Its free instances also lose local filesystem changes, including
SQLite, on sleep/restart/redeploy. Use durable backend storage for persistent
sandbox records, or explicitly identify a resettable mock-only deployment.
