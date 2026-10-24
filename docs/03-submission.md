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
| Render | Credits only | 3 | Persistent backend and SQLite disk; restart verified | Optional |
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
Studio’s 45-day trial covers the build window; the Grid/Charts bundle trial is 30 days. Starter repo:
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
| AG Grid / Studio | Grid + Charts: 30-day trial; Studio Pro + AI: 45 days | `/studio/license-pricing/` |
| APIMatic | 1 month Basic (Context Plugin use) | claim form on `/details/apimatic` |
| Channel3 | 20,000 API credits | promo code `PAYPAL-HACKATHON-2026` at `trychannel3.com/developers` |
| Elastic | 14-day trial, self-extend +30 | `ela.st/elastic-paypal-hackathon` |
| KERNEL | $50 credits | code `KERNELDEVPOST2026` |
| Bryntum | 45-day trial | `bryntum.com/download` |
| Zapier | 14-day Pro trial (has a PayPal action) | `zapier.com/sign-up` |
| Astropods | free tier | `astropods.com` |
| Discord | PayPal hackathon server | `discord.gg/sJ2G6DyvSK` |

AG Grid remains the sponsor target; Render now hosts the persistent sandbox backend. The rest are recorded so nobody
re-researches them.

## 6. Position the implemented product accurately

AgentMeter meters deterministic tool execution and transfers internal credits to
one author account. It uses PayPal for prepaid funding, accumulated author payouts
and independent reporting. The offline buyer plan is scripted; the later filmed
Codex model executes a requested hosted tool under a bounded three-cent allowance.
Agents do not negotiate prices or approve PayPal transfers.
There is no implemented platform/author revenue split, autonomous payment approval
or ACP integration. Do not quote broader inspiration examples as shipped behavior.
AG Grid is the single intended sponsor target; other used tools belong in the
Tools inventory without implying multiple sponsor awards.

## 7. Canonical English submission copy

The finalized local draft is [devpost-submission.md](../devpost-submission.md).
It includes the product story, actual AI and Codex usage, judge testing instructions,
links, screenshot plan, evidence boundaries and explicit remaining asset/access steps.
The timed English video plan is [01-demo-script.md](01-demo-script.md), with the
[recording/export checklist](08-recording-checklist.md).

Devpost authentication was unavailable during this final preparation pass. The
live form, current requirements and exact field limits have not been rechecked;
the historical strategy notes above are not a substitute. Nothing has been sent.
The actual public video URL and judge access remain to be supplied.

## 8. Submission checklist (tick at submit time)

- [ ] Repository public, **LICENSE visible in the About section**
- [x] README: English, setup + run instructions that work on a clean machine
- [x] README: "Tools" section naming every model/API and what it does
- [x] README: sandbox verification result table filled in (including pending/failed checks)
- [x] Working demo reachable: https://agentmeter-sandbox.onrender.com (operator token required); reproducible local mock also verified
- [x] English description draft: problem, audience, PayPal integration and limitations
- [ ] Demo video < 3:00, uploaded to YouTube, public, link on the form
- [ ] Video shows the app running on the device it was built for
- [ ] Video contains no third-party trademarks or copyrighted music
- [ ] Every material is English
- [ ] `PAYOUT_MODE` and mock/live mode stated honestly anywhere money appears

## 9. Risks recorded from the sponsor pages

- Trial dates are explicit: Grid/Charts expires 2026-11-23; Studio expires 2026-12-08.
  Do not assume the judging window fits either trial. The server suppresses expired
  keys and `/grid` retains its plain table, CSV and rule-driven widgets.
- The current sandbox uses a paid Render instance and persistent 1 GB disk, with
  a base estimate of $7.25/month. A free-instance alternative sleeps and has
  ephemeral storage; do not describe it as the deployed configuration. A deployment
  or restart may briefly interrupt requests. See `07-hosting.md`.

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
