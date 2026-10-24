# AgentMeter — recorded screen demo and presenter plan

Actual silent screen master: **170.000 seconds, 1920 × 1080, H.264, 30 fps, no audio**.
Recorded in Chrome through Computer Use on 2026-10-24. Source footage comes from an
actual Chrome-window capture, with browser chrome and unrelated applications excluded.
The current spoken script contains **310 English words**. It has not been recorded
by the presenter. Only the complete face/voice composition will be a final demo.

## Story and timed narration

A provider publishes a one-cent invoice API; three actual Codex MCP client calls
produce provider earnings. The local money flow is simulated. A separate closing
evidence scene reads the already-completed real PayPal sandbox payout on Render.
Gemini/Studio uses the actual model and licensed agent framework.

| Time | Screen / actual action | English narration |
| --- | --- | --- |
| 0:00–0:08 | Local overview: Hold the product overview; local mock mode is labeled. | “AgentMeter helps tool makers earn from useful APIs, while giving AI agents a budget and clear receipts.” |
| 0:08–0:36 | Local provider portal: Register the free invoice API example at $0.01, save a draft, test synthetic input, publish. Cuts omit setup pauses. | “Here is a simple invoice example. A provider registers a read-only API, sets a one-cent price, and tests a synthetic invoice. The invoice total is one hundred twenty dollars; the tool fee is only one cent. After a successful connection test, I publish the tool through AgentMeter’s MCP endpoint.” |
| 0:36–1:00 | Local buyer workspace: Show $5 before and $4.97 after three actual scripted Codex MCP calls; namespaced tool receipts and invoice output are visible. Transport runs off screen. | “The buyer starts with five dollars of test credit. The installed Codex MCP client sends three invoice requests to this registered service. Each successful execution settles once. The buyer now has four ninety-seven, and this provider has earned three cents. This is scripted transport verification, without a model turn.” |
| 1:00–1:10 | Local buyer workspace: Send FAIL_UPSTREAM to the same registered tool; show RELEASED, zero charge and unchanged credit. | “A deliberately failing request releases its reservation. It costs zero, and the buyer stays at four ninety-seven. Retries also avoid duplicate charges.” |
| 1:10–1:24 | Local personal provider portal: Show $0.03 own earnings, request mock payout, then show SUCCESS and zero remaining earnings. | “The provider can pay out those three cents. This local sequence uses simulated payments. A successful payout clears the earnings and preserves the receipt.” |
| 1:24–1:36 | Local reconciliation: Show two simulated reporting matches and separate gross, fee and net columns. | “Reconciliation checks funding and payout against the payment rail. Gross credit, fees, and net cash are separate. These two matches are simulated.” |
| 1:36–2:20 | Local Gemini/Studio and Grid: Submit the actual question in Studio AI Assistant; retain normal-speed model wait, Page-agent hand-back, model source and chart. Cut to the themed Grid. | “Now I ask, plot what I paid each calendar day during the current month. Real Gemini converts that question into a validated intent. Our custom Studio analyst delegates to the Page agent, which creates a chart and returns the task. The source names Gemini. This custom receipt widget and the themed Grid make usage visible. These views keep billing evidence beside the data. Historical rows are synthetic; analysis never moves funds.” |
| 2:20–2:42 | Hosted provider portal and reconciliation: Read-only view of the separately completed real sandbox payout; three independently verified rail receipts, with the new Search row visibly pending. | “This is a separate completed run on the permanent Render backend. The provider’s actual PayPal sandbox payout succeeded. Fresh PayPal reads verify the receipt. Transaction Search can arrive later, so its status stays visible. Restarting the service preserved the tools, balances, and receipts.” |
| 2:42–2:50 | Local overview: Reuse the opening product hold as a closing shot. | “Your service. Your price. A receipt for every call. AgentMeter: meter, settle, verify.” |

The canonical timing and voiceover remain `demo-timeline.json` and
`demo-voiceover.txt`. The editable shot sources are in `video/edit-list.json`.
The actor copy and Japanese filming notes are in [video/](video/presenter-guide-ja.md).

## What was captured

The new ignored take `data/recordings/take-mJBTdN/` has its own ledger and private
credentials. The old sandbox archive and hosted balances were not opened for writing.
The local buyer spent exactly 30000 micro-USD, retained 4970000, and the new provider
received a successful 30000-micro mock payout. A failed remote call charged zero.
The installed Codex app-server proof records the three successful calls and free retry.
Its test thread was ephemeral, with no model turn; autonomous tool selection is not claimed.

The invoice example is a free public demonstration endpoint on the same backend.
Its $120 input amount is not the one-cent usage fee and is not a payment of that invoice.
The $2.3750 custom receipt includes synthetic history plus live spend; it is not the
buyer's $4.9700 remaining credit. Historical rows are explicitly synthetic.

Hard cuts remove idle setup periods. Actual model execution plays at normal speed;
no screen states or financial results are reconstructed. The buyer scene shows actual
before/after UI and stored receipts while the scripted MCP transport executes off screen.
The separate hosted scene does not imply that preceding mock actions moved sandbox funds.

## Local deliverables

The machine-local packet is under `~/Movies/AgentMeter-demo-2026-10-24/`:

- `delivery/agentmeter-screen-only.mp4`: 170-second silent screen master with chapter/source labels.
- `delivery/presenter-rehearsal.html`: offline player with synchronized English actor copy.
- `delivery/narration-english.txt` and `.srt`: timed actor copy and optional subtitle guide.
- `delivery/撮影メモ.md`: Japanese instructions for recording the presenter's face/voice.
- `delivery/media-check.json`: measured codec, dimensions, duration and no-audio check.
- `raw/`: genuine recorded screen clips. Credentials stay in ignored `data/`, never in the delivery packet.

Optional local authoring tools are in `scripts/video/`. They require macOS 15+ /
Apple SDK for window capture and header rendering, FFmpeg for editing, and Python 3.10+.
They add no dependency to the Node application or normal `npm start`.

## Next production step

Record the presenter's real face and English narration, preferably with a few seconds
of lead/tail room; chapter takes are fine. Then edit mistakes, synchronize speech,
place the face in the lower-right corner without obscuring evidence, and retime subtitles.
No face/voice was synthesized or assumed received. Watch the entire final export and
measure it below 180 seconds before any public upload. YouTube publishing and Devpost
submission have not been performed.
