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

## Verification boundaries

- Local browser: three $0.01 calls changed $5.00 to $4.97, credited $0.03 to the
  provider, completed a simulated payout, and showed two matching external mock rows.
- Actual PayPal sandbox: app/OAuth/Reporting accessible; order created; payout
  rejected with HTTP 422 `INSUFFICIENT_FUNDS`. Seller funding was JPY, while the
  integration requires USD. Capture approval, webhook delivery and actual USD payout
  success remain unproven.
- AG Studio and Gemini: adapters implemented; no license/API key supplied, so no
  successful licensed Studio session or model response is claimed.
- Raw sandbox evidence is local under ignored `data/verification/`; credentials,
  account passwords, access tokens and private account records are not published.
