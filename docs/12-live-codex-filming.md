# Actual Codex model tool-use filming

Verified in Chrome on 2026-10-24. This extends the earlier direct, scripted MCP
transport proof; it does not rewrite that earlier test as model-driven execution.

| Check | Observed result |
| --- | --- |
| Runtime | Installed Codex CLI 0.160.1 app-server; `gpt-6.1-sol`; two ephemeral model turns |
| Client | Local privacy-filtered live filming page, not the stock Codex chat UI |
| Tool | Existing hosted provider's registered invoice HTTP API via AgentMeter MCP |
| Inputs | Three exact synthetic invoice strings; totals $120, $85 and $45; human review required |
| Successful calls | Three unique SETTLED receipts, each 10000 micro-USD |
| Buyer credit | 4940000 → 4910000 micro-USD ($4.94 → $4.91) |
| Provider credit | 0 → 30000 micro-USD ($0.03) |
| Independent read | Each receipt ID found in the hosted provider's own stored calls |
| New payment operations | No top-up/capture or payout; the new earnings remain unpaid |
| Guard | Only three approved inputs, fixed execution IDs, one-cent maximum quote; retries cannot spend more |
| Footage | Genuine Chrome-window capture, cropped before encoding to exclude browser chrome |

The model emits actual MCP tool-call items. The recording client forwards the
approved requests to the existing HTTPS Render backend. Its registered provider
gateway executes the service and settles internal prepaid credit. PayPal is not
charged separately for each tool call. All funds are sandbox test credit.
The sample API is public and free on this same backend; it does not implement OCR,
invoice approval or invoice payment. The tool is explicitly requested by the user
prompt; this is not a claim of unprompted selection among unrelated tools.

The first turn produced two attempts without settled receipts and one successful
invoice result. The remaining two invoices were processed by a second model turn,
with the same approved execution IDs retained. The final three receipt IDs and
buyer/provider deltas were checked against the hosted ledger. Retained footage
plays at normal speed; hard cuts shorten waits and omit resume setup. The on-screen
source label discloses two turns and cut waits. No result UI was reconstructed.

The later mock payout/failure scenes are separate local demonstrations. Earlier
completed hosted payout footage is historical evidence, not a payout of this new
three-cent earning. Existing rail receipts remain distinct from tool-call receipts.

## Privacy and reproduction

`scripts/video/live-codex.mjs` is an optional local filming client. It reads existing
private credentials server-side, binds to loopback, enforces Host/Origin on the
run control and uses a private Bearer token for the MCP capture endpoint. The page
receives only approved synthetic input, an allow-list of result/receipt fields,
and balance integers. It never receives raw model reasoning/messages, account
objects, cookies, keys, recovery codes, recipient emails or other chats. The
model runs in a scratch directory with shell, apps, plugins, web search and
multi-agent tools disabled. Setup refuses unrelated exposed MCP tools.

There is one run per take. A completed partial take may explicitly resume with
`--resume`, reusing its original nonces and checking that hosted balances still
match the partial proof. Ambiguous interrupted turns require inspection rather
than automatic repetition. A completed verified take cannot resume.

```sh
# This spends at most $0.03 of existing hosted sandbox credit per new take.
# It requires the existing private provider cookie, buyer key and operator token.
node scripts/video/live-codex.mjs \
  data/verification/providers/hosted-codex-input.json \
  data/recordings/new-live-codex-take
```

Private evidence stays in ignored `data/recordings/live-codex-20261024-01/`:
`execution-private.json`, `public-proof.json` and `hosted-confirmation.json`.
Delivery contains video and actor copy only. The machine-local revised packet is
`~/Movies/AgentMeter-live-tool-2026-10-24/`; the earlier packet is preserved.
The capture UI/proofs were inspected, and the final clips are checked for duration,
decode errors, absence of audio and exclusion of browser/private account chrome.

The client protocol follows the [official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).
