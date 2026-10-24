# Provider tools and own sandbox earnings

A signed-in personal workspace can create a separate provider profile at `/sell`.
The provider chooses a PERSONAL PayPal sandbox email and a price per successful
execution. Buyer credit and provider earnings are separate ledger accounts.
The recipient email is not ownership-verified; this is sandbox onboarding only.

## Register → test → publish → earn → pay out

Register either a public HTTPS JSON POST API (2xx JSON object/array success) or a
Streamable HTTP MCP endpoint and one named upstream tool. Supply an explicit object
schema: properties, required fields, arrays, enums and simple numeric/length bounds.
Schema references/composition, stdio, OAuth flows and interactive MCP requests are
unsupported. Operations must be read-only and safe to retry. AgentMeter forwards
arguments/results; it does not run uploaded code or host the provider service.

Registration produces a private draft. A synthetic connection probe must succeed
before publication. Probes have no buyer charge, but can consume provider API quota.
The two invoice example endpoints are deliberately free, public services on this
same backend; using them proves the HTTP gateway, not an independent proprietary
service. Independent test servers also exercise HTTP and sessionful MCP/SSE.

After publication, `/workspace` and `/mcp` advertise the stable provider-prefixed
name, provider and price. Use the workspace's Codex MCP configuration with the
buyer's own key. For example, after copying the actual published name:

```text
Use the registered invoice tool <published_tool_name> once on this synthetic text:
Invoice DEMO-101. Total $120.00. Due 2026-11-12. Contact billing@example.com.
Set _max_price_micro to 10000 (the listed $0.01 price) and _request_id to a fresh UUID.
Return the result and AgentMeter receipt. Do not retry with a new execution ID.
```

A higher current price is rejected before reserving credit. Reservations snapshot
the price and author. The gateway executes outside SQLite transactions, then either
settles the successful response or releases the full hold. Repeated execution IDs
return the original settled response; in-progress and released IDs never execute
again. New intended work needs a new ID. Normal MCP content carries the receipt,
including price, actual charge for this request and remaining buyer credit.

The provider sees only their tools, call credit/status and own payouts. Whole cents
can be requested through PayPal Payouts. Pending payouts retain the reservation and
reuse the same batch identity when polled. Success requires both batch and item
SUCCESS, matching USD amount and receiver. Failed/pending payouts are never shown
as received. The operator's `/reconcile` checks fresh Orders/Payouts separately from
independent, potentially delayed Transaction Search reporting.

## Boundaries and persistence

- Ten tools per provider; fifty published external tools globally; $1 maximum call
  price; ten connection probes per ten minutes/provider. These are prototype limits.
- Public HTTPS port 443, no URL credentials/query/fragment, redirects or internal
  addresses. All DNS answers must be public; the socket pins the vetted address.
- Responses are bounded to 128 KB, inputs to 32 KB, with a ten-second execution
  deadline. Bearer and X-API-Key credentials are encrypted using AES-256-GCM.
- The private 32-byte `DATABASE_PATH.upstream-key` file lives beside the SQLite file
  on the Render persistent disk. Backup/restore both together. It is Git-ignored.
  Encryption protects stored secrets, not a compromised application/disk owner.
- Endpoints/schemas are immutable after registration. A new credential pauses the
  tool and clears its connection-test approval. Prices can change; buyer maximums
  prevent silently charging an earlier lower quote.
- This is at-most-once charging with read-only external work, not guaranteed
  exactly-once external side effects. A crash after external completion can leave
  an uncharged call; startup releases stale tool holds. Pending payouts survive.
- No production funds, production identity/KYC, recipient ownership checks, refunds,
  disputes, tax handling, provider SLA, OAuth token refresh or arbitrary code hosting.

## Reproduce verification

```sh
npm test
npm run verify:provider
npm run demo:users
```

`verify:provider` uses a fresh isolated mock ledger and no model/license/payment
secrets. Register HTTP + MCP → test → publish → three one-cent calls → buyer $4.97 /
new provider $0.03 → own payout SUCCESS → two mock reporting matches. A repeated
call and a deliberately failed upstream both charge zero.

Actual Codex transport can also be checked with the installed `codex` CLI:

```sh
node scripts/verify-provider-codex.mjs private-input.json private-proof.json
```

The private input contains `{base,client_key,tools:[{name,arguments},...]}` with
exactly three calls explicitly priced at 10000 micro-USD. Nonces are saved before
sending so an ambiguous interruption can reuse them. This spends test credit.
The command starts an ephemeral Codex app-server thread and calls MCP directly;
it never starts a model turn or creates a persistent user chat. Do not describe
this as autonomous model selection. Keep the input/proof files outside Git.

## Hosted sandbox evidence — 2026-10-24

Runtime commit `450f47f`, Render deployment `dep-dbea741srm7s73bfi81g`.
The original frozen ledger was checked unchanged across the feature deployment
before registering or executing anything new. Subsequent changes below are
intentional, authorized sandbox usage, not an unchanged original demo balance.

| Check | Observed result |
| --- | --- |
| Provider onboarding | New personal workspace and separate provider account; own recipient settings |
| HTTPS API | Chrome draft registration at $0.01 → successful probe → publication |
| Streamable HTTP MCP | Separate registration, encrypted synthetic test credential, successful probe and publication |
| Actual Codex transport | Installed app-server discovers the published names; API → MCP → API, each SETTLED at 10000 micro-USD |
| Buyer credit | Existing funded sandbox buyer $4.9700 → $4.9400; no new funding or capture |
| Provider credit | New provider $0 → $0.0300; original built-in author remains $0 |
| Replay / failure / quote | Codex retry charged zero; hosted deliberately failed upstream released its hold; underquote rejected before work |
| Provider payout | Batch `RJEHDT8JUTF5N` and item SUCCESS; transaction `38K4028854295883W`; USD $0.03 and recipient match |
| Fresh rail read | PayPal Payouts GET VERIFIED, outgoing 30000 micro-USD, fee 0 |
| Reporting | Original capture and payout remain MATCH; new payout is PENDING_REPORT until Transaction Search returns it |
| Restart | New process ID, identical ledger hash, provider state, tool definitions, call receipts and payout receipts; browser session survives |
| Encrypted credential | MCP connection probe succeeds after restart using the persisted encrypted synthetic credential; no buyer charge |

This verifies the Codex MCP client calling tools directly in an ephemeral test
thread. No model turn was started; autonomous model selection is not claimed.
Both sample upstreams run on the same public backend. The synthetic Bearer credential
exercises encryption/decryption; the free example itself does not enforce that token.
External authentication/session/SSE behavior is additionally tested with independent
local upstream servers. No production funds moved.

The new global ledger identity is
`0bd6984c905e93428af993f7812dd6329ef74be770261aa489dd1815ba11a36d`.
All earlier tools, calls, top-ups, payout records and buyer API-key identity were
compared against the pre-feature proof and retained. The extra RELEASED call carries
zero charge. No old archive or original receipt was rewritten to manufacture a pass.

Private evidence is Git-ignored under `data/verification/providers/`: pre/post-deploy
snapshots, Codex receipts, payout API receipt, pre/post-restart snapshots and the
post-restart encrypted-credential probe. Recovery codes, cookies, client keys and
recipient email remain private. Recheck the hosted financial state read-only with:

```sh
npm run verify:deployment -- --allow-pending-report
```

The opt-in flag permits a separately verified fresh API receipt while preserving
PENDING_REPORT. Without it, every rail receipt must independently match Transaction
Search. Reporting can advance between restart snapshots; permanent receipt identities,
amounts and fees must remain the same. Tests: **79 passing**; the legacy demo,
personal workspace and provider mock verification commands also pass.
