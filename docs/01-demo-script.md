# AgentMeter — recorded screen demo and presenter plan

Updated silent screen master: **170 seconds, 1920 × 1080, H.264, 30 fps, no audio**.
The revised spoken script contains **289 English words**. Presenter face/voice,
final composition and public upload remain pending. The original master is preserved.

## Story and timed narration

Start with local registration, then show an actual Codex model calling a hosted
registered invoice API. Three successful calls spend $0.03 of existing PayPal
sandbox credit: buyer $4.94 → $4.91, provider $0 → $0.03. The filmed client is our
privacy-filtered app-server client, not the stock Codex chat UI. Keys, account
settings, browser chrome and unrelated applications are excluded.

| Time | Screen / actual action | English narration |
| --- | --- | --- |
| 0:00–0:06 | Local overview: Hold the local mock overview. | “AgentMeter lets tool makers sell useful APIs, with budgets and receipts for AI agents.” |
| 0:06–0:26 | Local provider portal: Local sample registration, probe and publication. This is separate from the hosted provider used next. | “A provider registers a read-only invoice API, sets a one-cent price, tests a synthetic input, and publishes it through MCP. This is a free sample service; the invoice amount is separate from the tool fee.” |
| 0:26–1:10 | Privacy-filtered Codex live client → hosted registered API: Actual gpt-6.1-sol turns, three stored hosted receipts, buyer $4.94 → $4.91 and provider $0 → $0.03. Two model turns; idle waits and resume setup removed by hard cuts. | “Now a live Codex model calls the registered invoice tool through MCP. Synthetic invoices and a filtered client keep keys and account details off screen. Three successful calls consume three cents of existing PayPal sandbox credit: four ninety-four becomes four ninety-one. The provider earns three cents. Each row shows the real result and backend receipt. We captured two model turns, cutting idle waits. A local gateway enforces the three-cent allowance.” |
| 1:10–1:18 | Separate local mock buyer: Show the earlier local zero-charge failure. These are different accounts from the hosted Codex run. | “In the separate offline demo, a failing request releases its hold and costs zero. Retries avoid duplicate charges.” |
| 1:18–1:32 | Separate local mock provider: Earlier mock payout success; the new hosted earnings remain unpaid. | “The offline provider can pay out three cents of simulated earnings. Success clears the balance and keeps the receipt. This is separate from the hosted Codex run.” |
| 1:32–1:40 | Separate local mock reconciliation: Hold the two earlier simulated reporting matches. | “Reconciliation separates purchased credit, payment fees, and cash received. These two matches use simulated payment receipts.” |
| 1:40–2:24 | Actual Gemini/Studio and themed Grid: Preserve the real Gemini/Studio handoff footage at normal speed, then the themed Grid. | “Now I ask, plot what I paid each calendar day this month. Real Gemini converts the question into a validated intent. Our custom Studio analyst delegates to the Page agent, which creates a chart and returns the task. The source names Gemini. The custom receipt widget and themed Grid expose usage and cost. Historical rows are synthetic; analysis never moves funds.” |
| 2:24–2:42 | Earlier completed hosted PayPal sandbox evidence: Earlier payout and reporting footage; no new payout was made for the Codex filming take. | “The permanent Render backend also has a completed PayPal sandbox payout. Fresh PayPal reads verify that receipt. Transaction Search may arrive later, so pending reporting stays visible. A restart preserved the recorded balances and receipts.” |
| 2:42–2:50 | Local overview: Close on the local overview. | “Your service. Your price. A receipt for every call. AgentMeter: meter, settle, verify.” |

Canonical timing and copy: `demo-timeline.json` and `demo-voiceover.txt`.
Shot sources: `video/edit-list.json`. Actor notes: [presenter guide](video/presenter-guide-ja.md).

## Source boundaries

The Codex scene is genuine Chrome footage of two ephemeral `gpt-6.1-sol` turns.
The first turn had one successful call and two attempts without settled receipts;
the second processed the remaining two invoices, preserving the approved execution
IDs. No more than $0.03 was spent. Hard cuts shorten idle waits and resume setup;
retained actions play at normal speed. No financial result or screen is reconstructed.
The source label discloses two turns and cut waits. The API is a free public sample
on the same Render backend; this does not claim proprietary OCR, invoice approval,
payment of the invoice itself, or unprompted tool selection.

The local mock failure/payout/reconciliation scenes and the earlier completed
hosted payout are separate demonstrations. The new $0.03 hosted earnings remain
unpaid; the older payout footage does not show those new earnings being paid out.
Gemini/Studio uses the actual model and licensed agent framework. Its historical
rows are synthetic, and analysis does not move funds.
See [live Codex evidence](12-live-codex-filming.md) for verification and privacy scope.

## Local deliverables

Revised packet: `~/Movies/AgentMeter-live-tool-2026-10-24/`.

- `delivery/agentmeter-screen-only.mp4`: revised 170-second silent master.
- `delivery/agentmeter-codex-live.mp4`: standalone 44-second actual-model scene.
- `delivery/presenter-rehearsal.html`: offline video with synchronized English copy.
- `delivery/narration-english.txt` and `.srt`: actor copy and optional subtitle guide.
- `delivery/撮影メモ.md`: Japanese presenter instructions.
- `delivery/media-check.json`: measured duration, codec, dimensions and no-audio check.
- `raw/`: original app-only window recordings; private connection files stay under ignored `data/`.

The earlier packet under `~/Movies/AgentMeter-demo-2026-10-24/` is an archive and
contains the superseded scripted transport scene. Use the revised packet for filming.
Optional local capture/edit helpers require macOS 15+, Apple SDK, FFmpeg and Python;
they add no dependency to the Node application.

## Next production step

Record real face and English voice, with a few seconds of lead/tail room. Chapter
takes are fine. Then edit mistakes, synchronize speech, position the presenter
without covering money/receipt evidence, and retime subtitles. Watch the complete
composition and measure it below 180 seconds. No face/voice was synthesized or
assumed received; no YouTube publishing or Devpost submission was performed.
