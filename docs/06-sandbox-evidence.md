# Actual PayPal sandbox evidence — 2026-10-24

This run used PayPal's real **sandbox APIs and fake sandbox funds**, not production
money and not AgentMeter's mock driver. Credentials, account profiles and raw
receipts remain in ignored `.env` and `data/verification/sandbox/` (mode 0600).
The repository contains no passwords, secrets or operator access tokens.

## Observed money loop

| Step | Actual result |
| --- | --- |
| Browser approval | Google Chrome PayPal popup identified SDK **6.70.0**, `integration_artifact=JS_SDK_V6`; buyer approved $5.00 |
| Orders capture | Order and capture COMPLETED; USD gross $5.00, fee $0.48, net $4.52 |
| Ledger funding | Buyer credited exactly 5,000,000 micro-USD once |
| Metering | Three live `extract_entities` calls SETTLED at 10,000 micro-USD each |
| After calls | Buyer 4,970,000 micro-USD; author 30,000 micro-USD |
| Payout | Actual $0.03 batch SUCCESS **and** single item SUCCESS; USD payout-item fee $0.00 |
| Final ledger | Buyer $4.9700; author $0.0000; both reservations $0.0000; invariants pass |
| Fresh receipt comparison | Independent Orders GET and Payouts GET verify capture amount/currency/fee/net and payout batch/item/transaction/receiver/amount/fee |
| Transaction Search | **PASS**: capture and outgoing payout are reported with matching USD gross and successful status; explicit fee sources are described below |

The in-app browser rendered the SDK button but could not open its approval popup.
The completed checkout used native Google Chrome. The order created by the earlier
popup attempt remains unapproved and uncharged; it is not a second capture.

The server credited capture at **04:00:52 UTC**. The signed
`PAYMENT.CAPTURE.COMPLETED` event was accepted at **04:01:12 UTC**, about 20 seconds
later, through the public HTTPS backend. The endpoint calls PayPal's signature
verification API before processing or deduplicating events. The buyer remained
credited once, as shown by the capture/call/payout invariant. Webhook registration
subscribes to `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED`.

PayPal's actual resend endpoint then returned HTTP 202. The re-delivered,
signature-verified duplicate was audited as `webhook.duplicate` at **04:28:25 UTC**.
Before/after account balances and reservations were identical. Private proof is
`data/verification/sandbox/webhook-replay.json`; no second credit occurred.

## USD prefunding and failed attempts

Two actual $0.03 payout attempts returned HTTP 422 `INSUFFICIENT_FUNDS` before any
batch was created. Their local FAILED records retain the failure evidence. Each
released its reservation and preserved the author's $0.03 earnings.

The business wallet showed existing JPY 5,000 test funding and USD 0. Its sandbox
currency-conversion flow exchanged **JPY 1,000 for USD 6.16**, leaving JPY 4,000.
The subsequent USD payout succeeded. This is platform test prefunding. It does not
prove the captured $5 became available cash immediately, or that gross tool credit
can fund payouts without covering fees. AgentMeter does not implement FX; this
conversion was sandbox account setup outside the application.

The $0.48 capture fee remains a platform expense, separate from buyer credit and
from the $0.03 author earnings. No production transfer occurred.

## Reconciliation boundaries

`MATCH` requires Transaction Search to return a successful USD transaction with
the expected signed gross. Its fee must agree with the ledger. The fee source is
shown explicitly: Search reports the capture's -$0.48 fee; for the payout it omits
`fee_amount`, so a fresh Payouts GET independently verifies USD $0.00 before a
match is allowed. An omitted field alone is not evidence of a zero fee. A failed
lookup stays `PENDING_FEE`; a contradictory fee/currency/receiver/amount fails.

Both actual transactions were present on recheck at **06:43 UTC** with reporting
watermark **2026-10-24T04:59:59Z**. V5 is now PASS. The first run's delay was real,
not an application crediting problem. PayPal's [Search schema](https://developer.paypal.com/api/transaction-search/v1/schema.json)
documents that its fee field has a value only for an applied and processed fee.
The app additionally requires the independent Payouts receipt when that field is
absent, rather than making a zero-fee assumption.

`VERIFIED` in **Live API check** means a fresh Orders/Payouts request independently
agreed with the ledger. A stored response cannot produce that state, and fresh API
verification alone cannot match a transaction missing from Search. Fresh request
failure is `UNAVAILABLE`; conflicting data is `MISMATCH`. These checks never move
money. A mismatch keeps the summary in a review state.

Repeat the existing flow verification without creating any additional payment:

```sh
npm run verify:sandbox:ledger
```

The script uses a read-only SQLite connection and GET requests only. It checks the
exact one-capture/three-call/one-successful-payout flow and prints V1–V7 plus FLOW.
V2 uses a separate, matching browser observation file; the command does not claim
to automate checkout. V7 remains MANUAL because no sandbox account was reset.
Private output: `data/verification/sandbox/ledger-latest.json`.

## Persistent backend and restart — completed

The original signed delivery used a Cloudflare Quick Tunnel to this Mac. That
verification backend has now been replaced by **https://agentmeter-sandbox.onrender.com**.
The existing PayPal Webhook ID and event subscriptions were retained; its URL is now
`https://agentmeter-sandbox.onrender.com/api/webhooks/paypal`.

The exact SQLite ledger was backed up after stopping the local writer, validated
and imported into Render's 1 GB persistent disk. Source/hosted ledger fingerprints
agree, including API-key hashes and call idempotency keys. PayPal's actual resend
was accepted on Render after signature verification; duplicate handling left all
balances and reservations unchanged.

After deleting the two bootstrap environment variables, a redeploy and an explicit
Render **Restart service** each produced a new process ID and retained buyer $4.97,
author $0, zero reservations, all receipt identities and the two Reporting matches.
Anonymous state access still returns 401. All five screens and the six-tool MCP
listing work on the hosted origin. See `07-hosting.md` for the repeatable checks.

The old local sandbox writer and Quick Tunnel are stopped. Local `.env` and the
frozen SQLite backup are private archives; do not restart that old sandbox writer
against the same PayPal app. Use `PAYPAL_MODE=mock` for independent local demos.
PayPal credentials remain on the backend; none are included in Dotfield assets.
