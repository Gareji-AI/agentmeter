# Development evidence — 2026-10-24

## APIMatic Context Plugin for PayPal

Installed into Codex with:

```sh
CP_TELEMETRY=off npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview --targets codex --yes
```

Installer reported `paypal@context-plugins-local` installed. Automatic skill loading
requires a new Codex session; in this build the source skills were read directly:
`typescript-getting-started`, `typescript-authentication`, `typescript-error-handling`,
and `typescript-configuration-resilience`.

The getting-started skill instructed reading real SDK source instead of guessing
fields. A read-only clone of `paypal/PayPal-TypeScript-Server-SDK` outside this
repository reported package version 2.5.0 at commit
`b02a9b9c8f53418d6278928fa41b174803037277`. No matching release tag was present in the
shallow clone; this records the exact inspected source, not a claim of compiled SDK use.

Observed in `src/models/sellerReceivableBreakdown.ts`: `paypal_fee` and `net_amount`
are optional. AgentMeter requires one of them, derives a missing fee from net, and
rejects non-USD breakdowns rather than mixing currencies. The resilience skill and
`src/defaultConfiguration.ts` distinguish a zero timeout / disabled retries from an
actual deadline. Our native fetch client sets explicit 20-second request deadlines;
a payout transport error retains the reserved balance and retry identity. API
rejection bodies are distinguished from ambiguous transport and batch-lookup errors.

The SDK is not installed as an AgentMeter dependency. The Context Plugin supported
implementation review; no PayPal MCP connection or SDK runtime usage is claimed.

## Verification progression

Initial checks found HTTP 422 `INSUFFICIENT_FUNDS` because the sandbox wallet held
JPY and the integration requires USD. At that point capture/webhook/payout success,
licensed Studio and real Gemini had not yet been proven. Those were historical
blockers, not the final state.

Subsequent evidence supersedes those early boundaries:

- [PayPal sandbox](06-sandbox-evidence.md): USD prefunding, SDK v6 buyer approval,
  $5 capture, three one-cent calls, successful $0.03 payout, signed webhook replay
  and both independent Transaction Search matches, with an explicit payout fee source.
- [Hosting](07-hosting.md): stable Render HTTPS, persistent SQLite disk, webhook
  destination switch and unchanged balances/receipt identities after restart.
- [Analytics](04-analytics-verification.md): actual licensed Grid/Studio, theme,
  custom receipt/cells, layout resize and framework delegation/hand-back in Chrome.
- [Gemini](05-gemini-verification.md): actual structured widget intent locally and
  on Render. Other live model paths remain outside the verified scope.
- [Recording](08-recording-checklist.md): isolated mock money rehearsal with real
  Gemini/Studio, without writing the archived or hosted sandbox ledger.

Raw evidence remains under ignored `data/verification/` and `data/recordings/`.
Credentials, account passwords, access tokens and private account records are not
published. A prepared script is not an exported video or a delivered Devpost entry.
