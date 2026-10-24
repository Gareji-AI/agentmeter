# AgentMeter — English demo, target 2:50

The full plan is **170 seconds / 265 spoken words**, including opening and closing.
At 130 words per minute this leaves about 47 seconds for actions and response time.
`npm run verify:recording` checks this estimate; only the exported video's measured
runtime proves it is under three minutes. Do not add a title sequence or long outro.

## Safe recording launch

Use Node 26+, an ignored `.env` with a working Gemini key and active Grid/Studio
licenses, and internet access. No package installation is needed.

```sh
npm test
npm run verify:demo
npm run verify:recording
npm run demo:record
```

Open the **exact local URL printed by the final command** in Chrome. Each launch
creates an unused `data/recordings/take-*/ledger.sqlite` and selects a free loopback
port. It overrides any hosted URL, sandbox keys, payout flags and archive path from
`.env`. It preserves Gemini and the evaluation licenses; only widget interpretation
uses the model in this profile. Other AI surfaces use deterministic behavior.
The existing sandbox ledger is never opened. Ctrl-C stops a take without deleting it;
launch again for a fresh $5 buyer / $0 author. Do not reuse the rehearsal take.

Read [the recording checklist](08-recording-checklist.md) before recording.
Use the Studio **AI Assistant message input**, not the separate Build a widget form,
so delegation and task hand-back appear on camera. Paste the prepared prompt once.

## Timed narration and actions

| Time | Screen and action | Spoken narration |
| --- | --- | --- |
| 0:00–0:12 | Buyer · fresh local take. Hold on the $5.0000 balance and MOCK badge. | “AgentMeter gives agent tool calls a spending limit and a receipt. This take uses simulated funds for the money flow and real Gemini for analytics.” |
| 0:12–0:33 | Buyer · three calls. Click Run 3-call demo once. Hold $4.9700 and $0.0300 author credits. | “One click runs a scripted three-call plan. Each call costs one cent. The ledger reserves before execution, settles successful calls, and credits the author. Five dollars becomes four ninety-seven; the author earns three cents.” |
| 0:33–0:47 | Buyer · failure. Click Try a tool failure. Show RELEASED and $0.0000 price. | “This deliberately failing tool releases its reservation. The buyer stays at four ninety-seven, and the receipt says released with zero charge. Retries reuse receipts.” |
| 0:47–1:04 | Provider · payout. Open Provider, show $0.0300, then click Pay out earnings. Hold SUCCESS and $0.0000. | “The author can now pay out the three cents. This take uses the mock payment rail. A successful batch and item receipt reduce the author balance to zero.” |
| 1:04–1:22 | Reconciliation · mock. Open Reconciliation. Show two MATCH rows and gross, fee and net. | “Reconciliation matches the funding and payout receipts. Gross credit, fees, and net cash stay separate. These two matches are simulated here; the separate PayPal sandbox evidence uses actual sandbox APIs.” |
| 1:22–2:06 | Analytics · real Gemini and Studio. Open Analytics. Submit the prepared paraphrase. Wait for Gemini model source, Page-agent delegation, hand-back and chart. | “Now I ask: plot what I paid each calendar day during the current month. Gemini Flash-Lite turns that wording into a structured intent. The server validates the metric, grouping, period, and tool. Our custom analyst delegates to Studio’s Page agent, which adds the chart and returns the task. The source explicitly names Gemini.” |
| 2:06–2:25 | Analytics · custom widget and layout. Resize the custom receipt. Briefly show the themed Grid and custom USD/status cells. | “This is our own receipt widget, alongside the themed Grid and custom money and status cells. I can resize the Studio layout. Charting reads the ledger; it never moves funds.” |
| 2:25–2:42 | Hosted reconciliation · separate completed sandbox run. Switch to the pre-authenticated Render Reconcile tab. Keep PAYPAL SANDBOX visible. Read-only; no new payment. | “This separate, completed PayPal sandbox run shows two independent reporting matches: capture and author payout. Signed webhook redelivery and a service restart preserved the same balances and receipt identities.” |
| 2:42–2:50 | Close · AgentMeter. Hold the app title and end. No long outro. | “Clone and run npm start. No package installation. AgentMeter: meter, settle, verify.” |

The timing and narration source is [demo-timeline.json](demo-timeline.json).
[demo-voiceover.txt](demo-voiceover.txt) contains the same spoken lines for a prompter.
Read at a measured pace and leave the model wait visible. If the generation fails
or its source says rules/fallback, stop the take and resolve it before recording again.

## Evidence boundaries on camera

Scenes 1–7 use **mock money and real Gemini/Studio**. The seed's 180 historical calls
are synthetic; the custom receipt includes history plus the three live calls. Its
$2.3750 settled-spend total is not the buyer's $4.9700 remaining balance.
The chart shows the current UTC month, and integer micro-USD axes with exact USD tooltips.

The 2:25–2:42 scene is a **separate, already completed PayPal sandbox run** on Render.
Pre-authenticate its Reconciliation tab privately. Keep its sandbox badge visible,
show both MATCH rows and fee sources, and make no new purchase, call or payout there.
Search supplies the capture fee; a fresh Payouts item read verifies the omitted
outgoing fee. Signed webhook replay and restart persistence are documented checks,
not actions demonstrated live in this short scene. See [sandbox evidence](06-sandbox-evidence.md)
and [hosting evidence](07-hosting.md). Never splice mock receipts into that scene.

The buyer plan is scripted. Models do not choose prices, negotiate, approve payments,
or change balances. The Studio Page agent uses our custom runner with shipped
framework tools; do not call it an unconstrained built-in model agent.

## Video title and description

**Title:** AgentMeter — Meter, Settle, Verify | PayPal AI Hackathon Demo

AgentMeter gives every agent tool call a price, a budget check and a receipt.
This demo shows simulated funding: $5.00 credit, three $0.01 calls, $4.97 remaining,
a released failed call, $0.03 author earnings, mock payout and reconciliation.
Real Gemini 3.5 Flash-Lite interprets a usage question; our custom analyst delegates
to the AG Studio Page agent to create a read-only chart. The workspace also includes
a custom receipt widget, editable layout, a theme and custom Grid cells.

A clearly separate completed PayPal sandbox run shows capture and payout matched
against Transaction Search, with explicit fee sources. Signed webhook replay and
restart persistence are documented in the repository. All funds are simulated or
sandbox test funds. Analytics history includes synthetic entries.

Run with Node 26+: clone the repository, then npm start. No package installation.
Project: https://dotfield.xyz/apps/agentmeter/
Application: https://agentmeter-sandbox.onrender.com (operator access required)
Source: https://github.com/Gareji-AI/agentmeter (judge access must be arranged)

Actual YouTube URL: pending recording, export inspection and public upload.

## Later provider run — separate evidence

The hosted ledger has since completed provider onboarding and three more one-cent
Codex MCP calls: API → MCP → API. The existing buyer is now $4.94; the new provider
received a $0.03 sandbox payout. The original capture/payout remain reporting
matches, while the new payout has a fresh verified Payouts receipt and a visibly
pending Transaction Search row. Scene 8 must show the actual labels, not imply all
three reporting rows match. See [provider walkthrough and proof](10-provider-tools.md).
The original local 2:50 rehearsal still starts at $5 and uses its own fresh ledger.
