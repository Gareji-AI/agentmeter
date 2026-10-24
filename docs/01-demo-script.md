# AgentMeter — full retake and presenter plan

The [2026-10-25 provisional edit](14-narrated-demo-edit.md) adds a temporary
English narrator, original Earshot audio and Open Design motion/captions to this
same 162-second story. The participant's real face/voice remains a later replacement.

Latest silent screen master: **162 seconds (2:42), 1920 × 1080, H.264, 30 fps**.
All selected footage was newly recorded in Chrome on 2026-10-24. The older masters
are archives. The updated English narration has **277 words**. Real presenter
face/voice, composition and public upload remain pending.

## One connected demonstration

A new hosted provider starts at zero, registers/tests/publishes one one-cent invoice
API, and receives three calls from the actual installed Codex CLI. The same funded
buyer goes from $4.91 to $4.88. That new provider earns $0.03, pays out this $0.03
through real PayPal sandbox Payouts, and reaches SUCCESS with zero held/available
credit. The same payout is independently checked in Reconciliation. Its Search
report is still pending, visibly distinct from a verified fresh Payouts read.
No mock payout or older payout footage appears in this retake.

| Time | Screen / actual action | English narration |
| --- | --- | --- |
| 0:00–0:06 | Hosted provider portal: New zero-earning provider, recorded at the start of this same take. | “AgentMeter lets developers sell useful tools to AI agents, with budgets and receipts.” |
| 0:06–0:36 | Hosted provider registration: Actual new draft, connection probe and publication of the same provider-prefixed tool used by Codex. | “I register a read-only invoice API, set the price to one cent, and test a synthetic invoice. After testing, I publish its stable MCP name. The example endpoint is free; this demonstrates how a provider meters access.” |
| 0:36–0:46 | Hosted buyer console: Show existing $4.91 credit and choose the new tool from the priced catalogue. | “The buyer already has four dollars and ninety-one cents of sandbox credit. I choose the newly published one-cent tool.” |
| 0:46–1:12 | Official Codex CLI output streamed to Chrome: Retain one continuous normal-speed interval from prompt entry through the three successful MCP calls and model answer. One CLI invocation, no resume or repeated turn. | “Here I enter a real request into the installed Codex CLI: review three synthetic invoices for at most three cents. Codex calls the registered MCP tool three times and returns the totals and due dates. These are actual CLI logs, streamed to Chrome with private data redacted.” |
| 1:12–1:22 | Hosted buyer console: The same newly registered tool appears in three new stored receipts; actual balance $4.88. | “Back in AgentMeter, all three calls are settled. The buyer now has four eighty-eight. Every result has a receipt.” |
| 1:22–1:44 | Same hosted provider portal: Actual $0.03 earnings → Pay out → SENT hold → SUCCESS and zero balances. Remove the intervening poll wait. | “The same provider started at zero and earned three cents from these calls. I request a PayPal sandbox payout. Pending funds remain reserved. Once the batch and item succeed, earnings and reserved funds return to zero. The payout receipt remains.” |
| 1:44–2:00 | Hosted reconciliation: Fresh API VERIFIED for this new payout, PENDING_REPORT preserved; three of four total payment-rail records match independent reporting. | “Reconciliation checks this payout against PayPal. The fresh API receipt agrees. Transaction Search has not reported the new transfer yet, so it stays pending. Fees, gross credit, and net cash remain separate.” |
| 2:00–2:36 | Hosted Gemini/Studio and AG Grid: Fresh actual Gemini request, visible model source and Page-agent hand-back, generated chart and custom receipt, then the new tool’s three-call/$0.03 row in themed Grid. Hosted ledger identity unchanged. | “Next I ask for daily spend this month. Real Gemini produces a validated intent. Our custom Studio analyst delegates to the Page agent, which creates the chart and hands back the task. The custom receipt widget and themed Grid show exact money and status cells. This tool has three paid calls. Historical rows are synthetic; analysis never moves funds.” |
| 2:36–2:42 | Hosted buyer console: New closing capture of the same buyer and $4.88 balance. | “Your tool. Your price. Clear receipts for every successful call. AgentMeter.” |

The canonical timing and voiceover are `demo-timeline.json` and `demo-voiceover.txt`.
Edit sources are `video/edit-list.json`; all ten raw clip filenames belong to the
new retake folder. See [retake evidence](13-full-demo-retake.md).

## What the viewer is seeing

The recording environment restricts automation of native terminal apps. Chrome
therefore displays the **installed official Codex CLI's real stdout/stderr** in a
local filming terminal. It is not a stock Codex desktop/TUI window, generated
conversation or simulated execution. The camera shows prompt entry, launch,
actual named MCP start/completion logs and the CLI's invoice table/charge answer.
The retained 26-second interval is continuous and at normal speed, from raw
`04-codex-cli.mp4` seconds 9–35. One CLI invocation exited zero with exactly three
MCP requests and three unique hosted SETTLED receipts. No retry/resume was needed.

A loopback capture gateway restricts execution to three synthetic inputs, binds
stable execution IDs and enforces one-cent maximum quotes. Credentials stay
server-side. The CLI runs without user config/plugins/shell/web/multi-agent tools,
in a scratch directory, under read-only policy. Personal paths and secrets are
redacted from the real text stream. Browser chrome, unrelated windows and
recipient/recovery settings are excluded from the encoded window capture.

Hard cuts remove registration setup, payout polling waits and analytics idle time.
Every retained action plays at normal speed. Every source range is checked against
its real recorded duration; the assembler has no freeze-frame padding. No financial
state was reset or reconstructed. The older provider's unpaid earnings are separate
from this fresh provider's successfully paid earnings.

The invoice sample is a free public endpoint on the same backend, not proprietary
OCR or invoice approval/payment. Invoice totals are input data, not tool fees.
The $2.4650 analytics receipt includes synthetic history plus live spend; it is
not the buyer's $4.88 balance. The themed Grid includes this new tool's three calls
and $0.03. The fresh Gemini/Studio session leaves the hosted ledger identity unchanged.

## Local delivery

Use `~/Movies/AgentMeter-retake-2026-10-24/`, not the two older packet folders.

- `delivery/agentmeter-screen-only.mp4`: the complete new 2:42 silent master.
- `delivery/presenter-rehearsal.html`: offline video and synchronized English actor copy.
- `delivery/narration-english.txt` / `.srt`: narration and optional timed subtitle guide.
- `delivery/撮影メモ.md`: Japanese presenter instructions.
- `delivery/media-check.json`: measured codec/duration, full decode and privacy notes.
- `raw/`: genuinely new window recordings, retained outside Git.

Credentials, execution nonces and private API evidence remain in ignored
`data/recordings/retake-20261024/`. The delivery ZIP contains only the reviewed
video, actor copy and previews. No public upload or Devpost transmission occurred.

## Presenter and final export

Record real face and English voice with lead/tail room; chapter takes are fine.
Edit mistakes and synchronize the delivery. Place the presenter without obscuring
money or status evidence, moving the face when the Reconciliation status column
needs space. Inspect the entire final composition and measure it below 180 seconds.
The measured silent master is not proof of a future composite's duration.
