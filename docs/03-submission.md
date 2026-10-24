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
| Render | Credits only | 3 | Zero (it is the host) | Free | 
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

Only Render and AG Grid are load-bearing for AgentMeter. The rest are recorded so nobody
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

## 7. The "Tools" answer (draft, ready to paste)

> **AgentMeter's AI stack**
>
> - **MCP (Model Context Protocol), Streamable HTTP.** AgentMeter *is* an MCP server. Any
>   MCP-capable agent — Claude Desktop, Cursor, Pi, a Zapier MCP client — can point at
>   `POST /mcp`, list the metered tools, and call them. Metering happens at the protocol
>   boundary rather than inside any one agent.
> - **Gemini 2.x Flash (Google).** Three jobs, all bounded: (1) turning a natural-language
>   budget instruction into a machine-checked cap ("keep summarise under $0.50 this
>   month"), (2) narrating the buyer agent's decisions for the demo, (3) semantic labelling
>   of tool-call clusters for the analytics view. The model is never on the money path —
>   pricing, reservation and settlement are deterministic, because a balance must not
>   depend on a model's mood.
> - **Deterministic planner for the buyer agent.** The agent that spends money is a state
>   machine reacting to real tool output (including the `INSUFFICIENT_FUNDS` JSON-RPC
>   error), with the LLM narrating. This is a deliberate reliability choice for a live
>   demo.
> - **APIMatic Context Plugin for PayPal (Claude Code).** Used during development to keep
>   the agent's view of the PayPal Contracts API aligned with the real schema.
> - **AG Grid (Studio / Grid + Charts).** The analytics surface at `/grid`, with a custom
>   cell renderer and a themed design system.
> - **Render.** Hosting for the demo build, using the hackathon credits.

## 8. Submission checklist (tick at submit time)

- [ ] Repository public, **LICENSE visible in the About section**
- [ ] README: English, setup + run instructions that work on a clean machine
- [ ] README: "Tools" section naming every model/API and what it does
- [ ] README: sandbox verification result table filled in
- [ ] Working demo reachable (hosted URL **or** reproducible local run — both for us)
- [ ] Text description: problem, audience, how PayPal is central (≤ the form's limit)
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
