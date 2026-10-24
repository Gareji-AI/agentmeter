# Persistent sandbox backend

## Prepared configuration

`render.yaml` defines a single Node 26.10.0 web service in Singapore with the
`0.5c-512mb` compute plan and a 1 GB persistent disk at `/var/data`. The ledger is
`/var/data/agentmeter-sandbox.sqlite`. It is not a free instance and should not
sleep from inactivity. Confirm the current dashboard price before provisioning.
The Render example estimates about $7/month compute and $0.25/month for a 1 GB disk;
usage, workspace charges and taxes can differ. Never silently upgrade the plan.

Build: `node --version`. Start: `node scripts/import-ledger.mjs && node src/server.mjs`.
No package installation is needed. Render's `RENDER_EXTERNAL_URL` supplies the
backend origin and PayPal return/cancel URLs unless `PUBLIC_BASE_URL` is explicit.
Do not put a localhost or Quick Tunnel URL in the hosted environment.

Auto-deploy is off. Keep one instance: local SQLite is a single-process ledger.
A disk-backed deploy can have a short outage; do not promise zero downtime.
Public information pages stay on Dotfield. Do not change PayPal's webhook to a
new address before its backend is ready to verify signatures.

## Private first-deploy ledger import

The successful sandbox ledger contains buyer credit, call identities, payout and
capture identities, verified Webhooks and idempotency records. Import it intact;
do not manufacture a balance or seed another $5 credit on the new host.

`import-ledger.mjs` accepts `LEDGER_IMPORT_GZIP_BASE64` and `LEDGER_IMPORT_SHA256` as
private runtime variables. It verifies the decompressed SQLite checksum, database
integrity, sandbox metadata and accounting invariants before atomically installing
an absent destination with mode 0600. It refuses to overwrite an existing ledger.
`REQUIRE_EXISTING_LEDGER=1` prevents starting an empty hosted sandbox by accident.
After a successful import, remove the two import variables; retain the requirement.
A restart uses the existing disk and cannot reapply an older snapshot.

The import variables contain private ledger data, including application API keys.
Never paste them in chat, commit them, print them in logs or place them in a URL.
There is no network-facing database import route.

## Cutover checklist

1. Complete Render login and connect only `Gareji-AI/agentmeter` to its GitHub app.
2. Review the exact compute/disk bill and obtain budget approval before creation.
3. Prepare this service's private sandbox Client ID/Secret, recipient, operator
   token and existing Webhook ID. The explicit `PAYOUT_MODE=execute` refers only
   to sandbox test funds; production PayPal API hosts remain rejected.
4. Freeze the local sandbox writer before taking the final SQLite backup. Keep
   the original ledger and private backup. There must not be two active writers
   for the same external PayPal app while moving the ledger.
5. Use SQLite's online backup API, not a live `.sqlite` copy that omits WAL. Compute
   a SHA-256 checksum and a gzip/base64 capsule locally; send only to this Render
   service's private environment. No secret values belong in the Blueprint.
6. Deploy, confirm `/health` says sandbox, anonymous `/api/state` returns 401, and
   signed-in state retains buyer $4.97, author $0, zero reservations, three calls
   and the successful $0.03 batch. Compare capture/payout IDs with the old ledger.
7. Patch the existing PayPal sandbox Webhook URL to the new HTTPS origin plus
   `/api/webhooks/paypal`. Keep both event subscriptions and the same Webhook ID.
8. Request PayPal to resend the previous capture event. Confirm a new hosted
   `webhook.duplicate` audit event and unchanged balances after signature checking.
9. Fetch hosted reconciliation: both Search transactions must reconcile, with
   the omitted payout fee verified through fresh Payouts GET and labeled clearly.
10. Restart the service; confirm `/health` returns a different `instance_id` and
    startup time, then repeat auth, balances, receipt IDs and reporting
    checks to prove disk persistence. Remove bootstrap variables and verify again.
11. Record the actual URL, resource IDs, timestamp and checks in private deployment
    evidence. Then update the README and Dotfield demo link. Stop the old tunnel.

If provisioning or verification fails, keep the original database. Restore the old
Webhook URL and resume that single local writer only after disabling the hosted
writer. Never merge two independently modified SQLite snapshots automatically.

References: [Render persistent disks](https://render.com/docs/disks),
[Blueprint specification](https://render.com/docs/blueprint-spec),
[Node version](https://render.com/docs/node-version),
[official cost example](https://github.com/render-examples/nanobot-render#cost-expectations).

## Repeatable hosted verification

Freeze and fingerprint the source ledger before importing it. Then check the hosted
service without creating another payment or metered call:

```sh
npm run verify:deployment -- --base https://YOUR-SERVICE.onrender.com \
  --expected data/migration/frozen-ledger-identity.json \
  --out data/verification/sandbox/render-before-restart.json
# After using Render's Restart service action:
npm run verify:deployment -- --base https://YOUR-SERVICE.onrender.com \
  --expected data/migration/frozen-ledger-identity.json \
  --previous data/verification/sandbox/render-before-restart.json \
  --out data/verification/sandbox/render-after-restart.json
```

The verifier sends GET requests only, rejects redirects, requires anonymous state
access to return 401, compares the exposed ledger state and API-key hashes, and
requires both actual reporting receipts to reconcile. The restart check also
requires a new process identity and unchanged ledger/rail receipt identities.
Raw evidence stays private under ignored `data/`; the token stays out of URLs/logs.
