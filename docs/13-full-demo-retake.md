# Complete new demo retake

Recorded on 2026-10-24. This retake supersedes the two earlier edited masters.
All selected source clips were newly captured for this request. The finished
silent screen master is 162 seconds, with an updated 277-word English voiceover.

## One tool, one buyer, one provider, one new payout

| Check | Observed result |
| --- | --- |
| Provider | New hosted `Invoice Demo Studio`, zero starting earnings |
| Registration | Actual draft at $0.01 → successful synthetic probe → publication |
| MCP tool | `p_413eb1e9fd36_invoice_api`, the same name in registration, CLI, buyer receipts and Grid |
| Client | Installed official Codex CLI 0.160.1, `gpt-6.1-sol`, one ephemeral exec invocation |
| Visible execution | Prompt entry → three named MCP calls → model-produced invoice table and $0.03 charge |
| Call proof | Exactly three gateway requests, three unique SETTLED receipts, CLI exit 0; no resume |
| Buyer | Existing funded sandbox credit 4910000 → 4880000 micro-USD |
| Author | This fresh provider 0 → 30000 micro-USD from those calls |
| Payout | This same provider's new $0.03 actual PayPal sandbox payout, batch/item SUCCESS |
| After payout | Available earnings 0, reserved earnings 0; receipt retained |
| Fresh rail read | New outgoing amount independently VERIFIED by PayPal API |
| Search | New payout PENDING_REPORT; three earlier payment-rail records MATCH |
| Analytics | New real Gemini validated intent → custom Studio analyst → Page agent → chart/hand-back |
| Grid | Themed Grid shows this tool's three calls, $0.03 spend and $0.03 author credits |
| Read-only proof | Identical hosted ledger identity before and after the analytics session |

The same existing $5 funding receipt underlies the buyer's prepaid credit. This
take did not perform another top-up or reset that balance. No production funds
moved. The tool requests review of synthetic invoice text; it does not approve or
pay those invoices. The underlying example endpoint is public and free on this
same backend; metering the demonstration does not make it proprietary.

## Filming method and privacy

Computer Use cannot operate the native terminal app in this environment. A local
Chrome filming terminal therefore runs the installed official `codex exec` process
and displays its actual stdout/stderr, with personal paths/secrets redacted.
The transcript is not synthesized. The original continuous source interval
`04-codex-cli.mp4` seconds 9–35 retains prompt input, launch, all three successful
MCP requests and the CLI's returned table. It plays at normal speed, without cuts
inside that interval. This is a browser view of real CLI output, not the stock
Codex desktop or TUI window. No extra user-owned chat or coding sub-agent was created.

Only the three exact synthetic inputs are allowed through the loopback capture
gateway. Stable execution IDs and 10000-micro maximum quotes cap tool spending at
$0.03. Authentication remains server-side. The CLI runs read-only without user
config, shell, web, apps, plugins or multi-agent tools. Complete-line redaction
prevents a credential split across stdout chunks from reaching the filming UI.
The source recordings encode only the Chrome content rectangle, excluding tabs,
bookmarks, profile names and other windows. Setup/recovery/recipient settings are
off camera. Synthetic `example.com` invoice contacts are not personal addresses.

Provider publication was captured again after a pause/republication, before any
buyer execution; no money was earned or spent during that setup. Hard cuts remove
registration setup, payout polling waits and analytics idle time. The assembler
checks every selected range against actual source duration and does not extend
screens with freeze padding. No older or mock payout clip appears in this movie.
The fresh $2.4650 analytics widget includes synthetic history and live spend, not
the buyer balance; the displayed note and narration distinguish them.

## Private evidence and delivery

Private inputs/proofs remain Git-ignored in `data/recordings/retake-20261024/`:

- `provider-private.json`, `client-private.json`, `cli-execution-private.json`.
- `cli-public-proof.json`, `calls-confirmed.json`, `payout-confirmed.json`.
- `deployment-after-payout.json`, `deployment-after-analytics.json`.

The source and delivery packet are under
`~/Movies/AgentMeter-retake-2026-10-24/`. The delivery ZIP contains reviewed video,
preview images, actor copy and Japanese presenter notes only. It excludes the
private inputs and raw API evidence. The two older movie folders are retained as
archives. No YouTube publishing or Devpost transmission was performed.

See [the exact 2:42 script](01-demo-script.md) and
[official Codex CLI documentation](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
