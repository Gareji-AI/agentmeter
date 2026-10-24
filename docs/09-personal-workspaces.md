# Personal sandbox workspaces

## Buyer journey

1. Open `/join`, enter a nickname and create a workspace. Save the recovery code
   shown once; there is no email/password service or email reset.
2. Open `/workspace`. The initial balance is zero. Create and approve a test top-up.
   Sandbox uses PayPal's approval link and the existing server capture/webhook path;
   mock mode offers an explicitly simulated approval button. Neither order creation
   nor a cancelled checkout adds credit.
3. Create a named client key. Save its one-time value privately and hide it.
   Configure it as `AGENTMETER_BUYER_KEY` in the environment launching Codex, then
   copy the displayed MCP configuration. A repository `.env` is not automatically
   the environment of a desktop app launched separately.
4. Set a monthly limit, inspect the tool prices and use a synthetic sample. The
   server enforces available credit and the cap. Receipts update on the personal page.
5. Revoke a client key to stop its next request. Sign out and use the recovery code
   at `/sign-in` to resume the same workspace.

Client configuration follows the [official Codex MCP documentation](https://developers.openai.com/codex/mcp/):

```toml
[mcp_servers.agentmeter]
url = "https://agentmeter-sandbox.onrender.com/mcp"
bearer_token_env_var = "AGENTMETER_BUYER_KEY"
```

Use a fresh `_request_id` UUID for every intended execution; reuse it only when
retrying that execution. Personal-key `tools/list` advertises this required field.
An explicit `Idempotency-Key` header can provide the same identity. A JSON-RPC ID
can repeat across independent connections and is not a sufficient billing key.
Insufficient credit returns `-32002` and the personal `/workspace#funds` URL.

## Concrete invoice-intake example

These are already-readable synthetic invoice texts, not PDF/OCR or accounting approval:

- DEMO-101: total $120.00, due 2026-11-12, `billing@example.com`.
- DEMO-102: total $85.00, due 2026-11-15, `accounts@example.org`.

Call `extract_entities` on each text, then `validate_links` once on the two example
invoice URLs. Each call costs $0.0100 at the sample prices: $5.0000 becomes $4.9700
and the existing tool author receives $0.0300 in internal earnings. Invoice face
amounts are source text, not money transferred by AgentMeter. URL validation checks
parsing and HTTPS; it does not establish vendor authenticity or link reachability.
A client can build a CSV from the returned fields; CSV creation is not another
implemented metered tool. No model or network is used inside these built-ins.

## Authorization and persistence

- Recovery codes: 256-bit random secrets, hash-stored, shown once, used for personal sign-in.
- Browser sessions: random, hash-stored in SQLite, seven days, HttpOnly and SameSite=Lax;
  Secure on HTTPS. Lax permits the top-level PayPal return. Cross-origin mutations
  are rejected; customer POST routes accept JSON only.
- Client keys: random, hash-stored, shown once, maximum five active per workspace.
  Metadata exposes only label, suffix and dates. They cannot manage credit, invoke
  Gemini adapters, view operator state/events, initiate author payouts or sign in.
- Personal data queries use the session's account ID, never a client-supplied owner ID.
  Top-up approval/capture and key revocation check ownership.
- The operator role remains separate. Legacy seeded keys retain their representation
  and their existing MCP behavior; no successful sandbox identities are rewritten.
- New schema tables are additive: `workspace_credentials`, `workspace_sessions`, `client_keys`.
  Signup is bounded to 500 workspaces, with process-local request limits. Active
  browser sessions are bounded to 20 per account. This is a test prototype, not
  production identity, abuse protection or author onboarding.

## Reproduction and verification — 2026-10-24

```sh
npm run demo:users
npm test
npm run verify:workspace
```

`demo:users` creates a fresh loopback mock ledger, suppresses the original mock
operator auto-login, clears payment/model/license credentials and needs no package
install. Its private `take.json` has the local operator token for a separate payout
demonstration. New personal workspaces still start at zero. The old local sandbox
archive and hosted ledger are not opened by this command.

Automated integration checks cover two-user isolation, one-time/hash-only credential
handling, ownership checks, revocation, caps, request-ID replay/conflicts, cross-origin
writes, expiry, logout and reopening a persistent SQLite database. The fresh HTTP
proof also pays the author $0.03 through the mock rail and matches all three rail
records: seeded operator funding, personal funding and author payout. This does not
replace the independent two-receipt actual sandbox evidence in `06-sandbox-evidence.md`.

Chrome passed signup, one-time code/key display, $5 mock approval, configuration copy,
three actual MCP executions reflected as $4.97 and three receipts, a zero-cap rejection,
key revocation followed by HTTP 401, logout/recovery sign-in, and retained balance,
session and receipts after restarting the local server.

The installed Codex **app-server** authenticated with the issued client key and
discovered all six tools with `toolsError: null` and `authStatus: bearerToken`,
using [the MCP inventory API](https://developers.openai.com/codex/app-server/).
This was an actual Codex transport/discovery check. No model turn was started and
no claim of autonomous Codex execution or recorded Codex video is made.
The invoice calls were separately executed through HTTP MCP.

Private evidence is Git-ignored under `data/verification/workspaces/` and the
local rehearsal's `data/recordings/take-*/`. No recovery code, client key or cookie
belongs in public documentation, screenshots or video.

## Hosted release verification

Runtime commit `d91bd27` deployed successfully to the existing Render service as
`dep-dbe9eu1srm7s73bd1nog`. Public entry:
https://agentmeter-sandbox.onrender.com/join . No compute, disk, PayPal key or
Webhook destination change was required.

Chrome verified public registration, zero credit and no shared history, one-time
client-key display, revocation and sign-out. Recovery-code sign-in and Secure/
HttpOnly session cookies passed over HTTPS. The installed Codex app-server
successfully authenticated against the public MCP URL and discovered all six tools
with no tool-discovery error. A zero-credit execution returned `-32002` with the
personal funding URL; the request did not create a charged call. The revoked key
subsequently returned HTTP 401. No hosted top-up, paid call or payout was performed.

The deployment produced a new process identity while preserving the original demo
ledger SHA-256 `3cdb60d7b29727e79ac302b56f4002f3254647d7b800e3411c8bf65d2254ad90`,
buyer $4.9700, author $0.0000, zero reservations and both actual sandbox reporting
matches. The new verification account contains no financial activity. Frozen-source
comparisons document this deployment checkpoint; legitimate future customer funding
and tool usage will change the global ledger and reporting counts.

Private evidence: `data/verification/workspaces/hosted-proof.json`,
`hosted-codex-discovery.json`, and `data/verification/sandbox/workspaces-*-deploy.json`.
The public information, privacy, terms and support pages were updated through the
Dotfield repository (`1141060`) and verified over HTTPS after deployment.
