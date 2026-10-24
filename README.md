# AgentMeter

**A metered billing rail for AI tools.** An AI agent pays per tool call in PayPal; tool
authors get paid out automatically.

> Status: **private, pre-release.** Built for the
> [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). The repository becomes
> public with an MIT licence at submission time.

## Why this exists

Card rails are economically useless below roughly $0.30. A model calling a small tool
five hundred times a day cannot pay $0.30 per call, so the whole "agent pays for
capability" category is blocked on metering, not on intelligence.

AgentMeter sits between an AI agent and the tool it wants to use. It prices the call,
reserves the funds, invokes the tool, settles or releases, and keeps a ledger that
reconciles against PayPal. Authors accumulate a balance and get paid out through the
PayPal Payouts API.

## Status of the build

| Area | State |
|------|-------|
| Design decisions | done — `docs/00-decisions.md` |
| Sandbox verification plan | done — `docs/02-sandbox-verification.md` |
| Sandbox verification results | **pending — Day 1 gate** |
| Ledger + metering | not started |
| MCP server | not started |
| PayPal top-up | not started |
| Payouts + reconciliation | not started |
| Demo video | not started |

Nothing here claims to work yet. When it does, this table changes in the same commit.

## Documentation

- [`docs/00-decisions.md`](docs/00-decisions.md) — locked decisions, verified vs.
  unverified PayPal surface, architecture, data model, scope, kill switches.
- [`docs/02-sandbox-verification.md`](docs/02-sandbox-verification.md) — the Day-1
  pass/fail gauntlet for Orders, JS SDK, webhooks, Payouts, Transaction Search, and the
  Agent Toolkit MCP server, with a fallback ladder for each.

## Licence

MIT (added at public release).
