# Gemini widget verification

Date: 2026-10-24. Model: `gemini-3.5-flash-lite`.

## Configuration

A dedicated Google AI Studio project, **AgentMeter**, holds the key named
**AgentMeter sandbox analytics**. Chrome displayed the Free tier; no billing
account was added. The user confirmed key creation and storage immediately before
issuance. The key is stored in ignored `.env` (0600) and Render's private service
environment, not source, HTML, browser scripts, screenshots, or verification files.

`GEMINI_MODEL=gemini-3.5-flash-lite` selects the verified model. The previous
`gemini-3.8-flash` configuration authenticated successfully but exceeded the bounded
generation deadline during local probes. Flash-Lite completed the three direct
verification prompts in 1,048–1,609 ms. This is a sample, not a latency guarantee.

Google documents [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output),
[API key security](https://ai.google.dev/gemini-api/docs/api-key), and
[free-tier data handling](https://ai.google.dev/gemini-api/terms#unpaid-services).
The public privacy page was updated before enabling the hosted model runtime.

## Evidence boundaries

Widget interpretation sends only the question and tool names to Gemini. A schema
restricts the response to the allowed metric, grouping, period, and optional tool.
The server validates the result, and only then does the custom Studio analyst
delegate it to the Page agent. Model output cannot execute tools, create SQL,
change prices or move funds. The financial ledger and widget aggregation still use
integer micro-USD. Failed or invalid model responses do not claim Gemini success.

The verified path is **widget interpretation**. Other adapters for budget intent,
narration and synthetic labeling have unit coverage; their actual model paths are
not claimed as verified here.

| Synthetic request | Expected validated view | Direct API | Local Chrome |
|---|---|---|---|
| Plot what I paid each calendar day during the current month. | spend / day / month | PASS | PASS |
| Compare the number of invocations for each utility over the last 30 days. | calls / tool / 30 days | PASS | — |
| For extract_entities, chart daily author earnings this month. | author credits / day / month / named tool | PASS | — |

The first paraphrase cannot be interpreted by the keyword-only fallback. Chrome
showed `Gemini · validated intent (gemini-3.5-flash-lite)`, Page-agent delegation,
task hand-back, and the generated chart. The REST response supplies the recorded
model version; the verifier rejects rule-parser fallbacks or missing model identity.

## Reproduction

With a private `GEMINI_API_KEY` configured:

```sh
npm run verify:ai -- --out data/verification/ai/direct-gemini.json
npm run verify:ai -- --base https://agentmeter-sandbox.onrender.com --out data/verification/ai/hosted-gemini.json
```

The hosted check also needs the existing `DEMO_ACCESS_TOKEN`. It compares hashed
ledger identities before and after the three read-only questions. Proof files are
private and ignored. `npm test` remains offline: **58 tests pass**, including
schema construction, prompt minimization, ignored thought parts, provider errors,
truncated output, invalid intent, fallback, and the remaining adapters.

`npm run verify:demo` also passes without a model key. Hosted verification will be
recorded after the runtime deployment.
