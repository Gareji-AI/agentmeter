# Licensed analytics verification

Date: 2026-10-24. Browser: Google Chrome on macOS.

## Evaluation licenses

AG Grid + AG Charts Enterprise Bundle: 30 days, expires 2026-11-23.
AG Studio Pro with AI: 45 days, expires 2026-12-08.
Both were requested from AG Grid's official forms and email-verified. Marketing
opt-in was left off. Keys are kept in ignored `.env` and private hosting settings;
they are client-visible evaluation licenses, never payment or model API credentials.

Pinned compatible versions: Grid 36.2.0, Charts 14.2.0, Studio 3.0.0. No npm runtime
dependencies or build step were added. Libraries load only for configured analytics.
The server suppresses expired trials; the plain SSR table and validated widget cards
remain available. These keys authorize evaluation only, not commercial production.

## Chrome checks

| Check | Local result |
|---|---|
| Licensed Grid with Quartz theme and custom state/money cells | PASS |
| Studio forest theme, readable native controls, collapsed edit/data panels | PASS |
| Custom receipt matches settled synthetic usage total: $2.3450 | PASS |
| “Show daily spend this month” creates a chart limited to the UTC month | PASS |
| “Show calls by tool” creates the grouped usage chart | PASS |
| Custom metering analyst → Studio Page agent → add_widget → complete_task | PASS |
| Resize a custom receipt using Studio's layout handles | PASS |
| No keys: SSR table and “Show released calls by day” widget | PASS |
| Automated suite, including expiry boundaries and asynchronous run failure | 55/55 |
| Fresh-process mock money path | PASS |

Chart axes retain integer micro-USD; captions state the unit. Money tooltips and
the receipt use exact USD formatting. Counts and monetary mappings are distinguished.
The deterministic custom runner uses Studio's shipped harness, delegation, Page
agent definition, tools and chat events. Gemini remains unconfigured: this proves
Agent Framework execution, not language-model inference.

The custom receipt reads Studio's resolved field key rather than guessing a source
identifier. Missing/unsafe values cannot silently become a zero receipt. Submission
waits for the chat session's actual completion and surfaces errors/timeouts.

## Hosted verification

The first licensed Render deployment used runtime commit `956f573` on 2026-10-24. Both evaluation keys are
installed in private service environment variables. Chrome verified the themed Grid,
custom receipt **$2.3750** (synthetic history $2.3450 + live settled calls $0.0300),
month-filtered spend chart, and the Studio chat request “Show calls by tool”. The
chat visibly recorded delegation to Page agent and task hand-back for both requests.
No watermark was visible.

`npm run verify:deployment` passed against the frozen source and the pre-deploy
snapshot: a new process identity, unchanged ledger SHA-256
`3cdb60d7b29727e79ac302b56f4002f3254647d7b800e3411c8bf65d2254ad90`, buyer balance
$4.9700, provider balance $0.0000, and the same two PayPal Transaction Search matches.
Analytics interactions made no paid calls and no new transfers. Private evidence
under ignored `data/verification/sandbox/`: `ag-before-deploy.json`,
`ag-after-deploy.json`, `ag-analytics-runtime.json`.
