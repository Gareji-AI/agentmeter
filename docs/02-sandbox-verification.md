# Day-1 Sandbox Verification Plan

Purpose: prove or kill every PayPal dependency **before** writing product code.
Total time budget: **4 hours**. If an item fails, the fallback in the right column is
used and the architecture doc is amended the same day.

## 0. Prerequisites (30 min)

| Step | Action | Done when |
|------|--------|-----------|
| 0.1 | Create/ログイン `https://developer.paypal.com/` | Dashboard visible |
| 0.2 | Create **two** sandbox accounts: one `BUSINESS` (seller) and one `PERSONAL` (buyer) | Both listed under Testing Tools → Sandbox Accounts |
| 0.3 | Create an app under the seller account, note **Client ID** / **Secret** | `SANDBOX_CLIENT_ID`, `SANDBOX_SECRET` in hand |
| 0.4 | Generate a merchant access token with `curl` | `POST /v1/oauth2/token` returns `access_token` |
| 0.5 | Expose a local port publicly for webhooks (`ngrok http 8787` or Render) | Public HTTPS URL returns 200 |

```bash
curl -s -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -u "$SANDBOX_CLIENT_ID:$SANDBOX_SECRET" \
  -d grant_type=client_credentials | jq -r .access_token
```

## 1. Checks (each is pass/fail, record the raw response)

### V1 — Orders create + capture + fee visibility

```bash
# create (server side)
POST /v2/checkout/orders   { intent: CAPTURE, purchase_units: [{ amount: { currency_code: USD, value: "10.00" }}] }
# capture (server side)
POST /v2/checkout/orders/{id}/capture
```

Pass criteria:
- Capture returns `status: COMPLETED`.
- Response contains `seller_receivable_breakdown.paypal_fee.value`.

Fallback if fee absent: fee = `gross_amount − net_amount` from
`capture.payments.captures[0].seller_receivable_breakdown`.

### V2 — JS SDK v6 buttons with a sandbox client only

Render the `paypal-buttons` element with `client-id=<sandbox client id>` and
`intent=capture`, complete a payment as the PERSONAL sandbox buyer.

Pass criteria: browser completes and calls `onApprove`, order id reaches the server.
Fallback: `/topup` renders a plain redirect to the `approve` link
(`GET /v2/checkout/orders/{id}` → `links[rel=approve]`), still a real PayPal flow.

### V3 — Webhook delivery + signature verification

Subscribe to `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED` on the sandbox app.

Pass criteria:
- Event arrives at the public URL within ~30 s.
- `POST /v1/notifications/verify-webhook-signature` returns `verification_status: SUCCESS`
  when the raw body + `paypal-transmission-*` headers are forwarded verbatim.

Fallback: verify by re-fetching the order/capture from the API and trusting that
(must be documented as a deliberate choice, not hidden).

### V4 — Payouts API (the single most dangerous dependency)

Needs the seller sandbox account to have a **payments/receive** capability and a business
verification state. Steps:

1. `POST /v1/oauth2/token` with the second (business) sandbox app credentials.
2. `POST /v1/payments/payouts` with a single item, `recipient_type: EMAIL`,
   receiver = the PERSONAL sandbox account email, `value: "0.03"`.
3. Poll `GET /v1/payments/payouts/{batch_id}`.

Pass criteria: batch status reaches `SUCCESS` and item status `SUCCESS`.

Fallback ladder (in order):
1. Retry with `recipient_type: PAYPAL_ID` using the buyer's payer_id.
2. Retry with `recipient_type: PHONE` if the sandbox account has a phone.
3. Use `POST /v2/payments/referenced-payouts` (alternative rail).
4. Documented dry-run: AgentMeter computes the exact payload, stores it, shows it in the UI,
   and the demo states "payload generated; sandbox payout requires a business-verified
   sandbox app". **This weakens the demo** — only accept it on Day 2 and only with the
   receipt of what failed.

### V5 — Transaction Search for reconciliation

```bash
GET /v1/reporting/transactions?start_date=...&end_date=...&fields=all
```

Pass criteria: the captured top-up appears with `transaction_amount`,
`fee_amount` and `transaction_status` fields. Compare gross and fee with the ledger;
derive net from those amounts. Preserve a returned net field when supplied.

If Search returns a successful payout transaction with matching USD gross but
omits its optional fee, require a fresh, matching Payouts item fee and label that
source explicitly. Failure to retrieve it stays PENDING_FEE; a disagreement fails.

Fallback for an absent Search transaction: display fresh Orders/Payouts GET verification separately. Stored capture
responses are labeled receipt-only; neither fallback counts as a Transaction Search
match. Reporting may take up to three hours to include a new transaction.

### V6 — Agent Toolkit MCP tool availability

```bash
PAYPAL_ACCESS_TOKEN=<token> SANDBOX=true npx -y @paypal/mcp --tools=all
```

or point at the remote endpoint:

```json
{ "mcpServers": { "paypal": { "command": "npx", "args": ["-y", "mcp-remote", "https://mcp.sandbox.paypal.com/sse"] } } }
```

Pass criteria: `tools/list` enumerates the tools named in the docs
(`create_order`, `pay_order`, `list_transaction`, `get_merchant_insights`, …).

Record the **exact** tool list into `docs/agent-toolkit-tools.md` — the submission asks
which tools were used and how.

Fallback: call the REST endpoints directly; the submission then names the REST APIs instead.

### V7 — Sandbox cleanup / test data

Confirm a test account can be reset (Testing Tools → Sandbox Accounts → Reset) so the
demo video can start from a clean ledger.

## 2. Decision gate

After V1–V7, write the result table into the README under **"Sandbox verification"**:

| Check | Result | Evidence (file/URL/screenshot) |
|-------|--------|-------------------------------|
| V1 | | |
| ... | | |

Go / no-go rule: **Payouts (V4) must pass at ladder step 1–3.** If it falls to step 4,
the project is still shippable but the pitch shifts from "pays authors automatically" to
"meters and settles; payout payload verified against the sandbox contract" — that change
must be reflected in the 3-minute script, not discovered on Day 17.

## 3. Timeboxing

- 0–30 min: prerequisites.
- 30–90 min: V1, V2.
- 90–150 min: V4 (hardest; do it while fresh).
- 150–180 min: V3, V5.
- 180–210 min: V6, V7.
- 210–240 min: write the table + amend this doc + commit.


## 4. Implementation checkpoint — 2026-10-24

The Day-1 gate was not fully passed before implementation. On 2026-10-24 actual
sandbox V1, V2, V3 and V4 passed. The initial V4 `INSUFFICIENT_FUNDS` rejection was
resolved by converting existing JPY sandbox test funds to USD before retrying.
V5 also passed once Transaction Search reported the capture and outgoing payout.
Search supplied the capture fee; a fresh Payouts GET verified the fee omitted from
the outgoing report. Its source is shown explicitly, without treating absence as zero.
V7 remains manual; no account evidence was erased. V6 is skipped because direct
REST is used. The README contains the current table and `06-sandbox-evidence.md`
records the completed money loop and operational limits.

Use `npm run verify:sandbox:ledger` to repeat read-only checks of the existing
application ledger. The original `verify:sandbox` script creates/captures a test
order and optionally sends a new payout; it is not the repeat-verification path.
`--mock` only proves simulation checks. Neither CLI command automates browser V2.
