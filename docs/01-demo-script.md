# AgentMeter — 2:50 demo script

Language: English. Target duration: **2 minutes 50 seconds**, including opening and
closing frames. Hard limit: under 3:00. This script describes the verified **mock**
path. Keep the application's “MOCK / simulated funds” indicator visible throughout.
This recording does not itself prove a sandbox capture or payout. A separate actual
sandbox run has now passed capture, SDK v6, signed Webhook and successful payout;
its Transaction Search rows remain pending. See `06-sandbox-evidence.md`.

## Prepare a clean recording

Use Node 26+. Run `npm test` and `npm run verify:demo`. Stop any previous recording
server using its own terminal. Choose an unused database filename for each take:

```sh
PAYPAL_MODE=mock DATABASE_PATH=data/recording-take-1.sqlite PORT=8788 npm start
```

Open `http://localhost:8788/app`. Confirm Available **$5.0000**, Reserved **$0.0000**,
Settled this session **$0.0000**, and Provider available **$0.0000**. A filename used
for an earlier take reopens its existing ledger; use a new filename for a fresh take.
No deletion of existing data is necessary. If 8788 is occupied, choose another port.

Use a 1440 × 900 or larger desktop viewport at 100% zoom. Pre-open Buyer, Provider,
Reconcile and Analytics in tabs, refresh them after actions, and keep navigation
visible. Remove any existing local widget cards with their Remove buttons so the
widget creation is clear. Synthetic history is expected and is not external evidence. Keep its disclosures
closed during the main sequence; the Recent call receipts panel shows live calls
beside the tool controls. The new money-trail links connect Buyer, Provider and
Reconciliation.

## Timed narration and actions

| Time | Screen and action | Spoken narration |
| --- | --- | --- |
| 0:00–0:15 | Buyer. Hold on $5.0000 and the visible mock indicator. | “AgentMeter gives every agent tool call a budget check and a receipt. This demonstration uses simulated funds. The same integration includes PayPal sandbox funding, payouts and reporting, with real verification limits documented.” |
| 0:15–0:40 | Click **Run 3-call demo** once. Show $4.9700 available and $0.0300 settled. | “Our buyer starts with five dollars. This scripted plan runs three entity-extraction calls at one cent each. Before execution, AgentMeter reserves the price. A successful result settles the charge and credits the author. We now have four dollars and ninety-seven cents.” |
| 0:40–0:58 | Click **Try a tool failure**. Hold the notice, RELEASED row and unchanged $4.9700. | “A tool can fail after funds are reserved. This failure releases its two-cent reservation and charges nothing. The event trail shows the change. Retrying the same request key also reuses its receipt instead of billing twice; that behavior is covered by the tests.” |
| 0:58–1:20 | Provider. Show $0.0300, click **Pay out earnings**. Show SUCCESS and $0.0000 available. | “The author has earned three cents from those successful calls. Paying out uses one stable batch identity. Here the simulated rail returns a successful batch and item receipt, then the ledger debits the earnings. Ambiguous failures hold the funds until their outcome is known.” |
| 1:20–1:45 | Reconcile. Refresh if needed. Show 2 matches and gross / fee / net columns. | “Reconciliation compares our ledger with independent reporting from the selected rail. Both current mock receipts match. The five-dollar top-up has a separate illustrative fee and net cash amount. Tool credit and cash received are different quantities. Synthetic history is excluded from this comparison.” |
| 1:45–2:10 | Analytics. Submit **Show daily spend this month**. Show the widget; move a card if available. | “The analytics workspace starts with thirty days of synthetic usage. A natural-language request produces this daily-spend widget using a validated rule parser. The table, widgets and CSV work without a license or model. Licensed Grid and Studio adapters are implemented but await actual license verification.” |
| 2:10–2:30 | Buyer. Replace budget text with **Keep extract_entities under $0.00 this month**; Apply budget, then Run 3-call demo. Show BUDGET_EXCEEDED and unchanged balance. | “Now I set this tool's monthly cap to zero. The next call is blocked before execution, so no new charge appears. Intent may be interpreted by an optional model, but prices, reservations and settlement always use exact integer arithmetic.” |
| 2:30–2:50 | Hold Reconcile or Buyer; end on title and local-run instruction. | “AgentMeter runs from a clean clone with Node twenty-six and npm start, without installing packages. The mock money loop is complete. A separate real sandbox run verified funding, signed webhooks and author payout. Transaction Search, licensed Studio and optional Gemini remain pending. The repository includes tests, evidence boundaries and reproducible instructions.” |

Aim for a calm pace. Rehearse to the timestamps; shorten narration if any click takes
longer. Leave the last two seconds silent on the application. Do not add a long outro.

## Recording checklist

- [ ] Start from a new recording database: $5.0000 buyer, $0.0000 provider.
- [ ] Mock indicator visible; no statement implies real money or proven sandbox payout.
- [ ] Record actual running UI; do not replace outcomes with edited screenshots.
- [ ] Capture $4.9700, RELEASED / zero charge, $0.0300 earnings, payout success, two matches.
- [ ] Show the fee column, rule-parser source and zero-cap rejection.
- [ ] Record app content only: hide bookmarks, extensions, unrelated tabs and third-party logos.
- [ ] No music, stock footage, third-party brand artwork or copyrighted soundtrack.
- [ ] Hide API keys, access tokens, terminal secrets and private account details.
- [ ] Narration, captions, title and description all in English.
- [ ] Check legibility and audio using the exported file, not just the editor preview.
- [ ] Export and inspect duration: less than 3:00, ideally 2:50 or shorter.
- [ ] Upload to YouTube with visibility **Public**, then test playback while signed out.
- [ ] Add the actual video URL and verified demo/local-run information to the submission.
- [ ] Repository access/public visibility and MIT license checked before submission.

## Video description draft

AgentMeter: every agent tool call gets a price, a budget check and a receipt.

This video demonstrates simulated funds: $5.00 prepaid credit, three $0.01 tool
calls, $4.97 remaining, $0.03 author earnings, a simulated payout and receipt
reconciliation. A separate actual sandbox run verified SDK v6 funding, signed Webhook
delivery and successful author payout. Transaction Search is still catching up; see
the README's evidence table. Optional licensed Studio and Gemini paths are not
represented as verified in this recording.

Run locally with Node 26+: clone the repository, then `npm start`. No package
installation is required. Project information: https://dotfield.xyz/apps/agentmeter/

Repository: https://github.com/Gareji-AI/agentmeter (ensure judge access before posting).

## Upgrade the recording only after new evidence

Actual USD capture, payout and Webhook checks have now passed. To record a separate
sandbox take, keep the sandbox badge visible and use the actual receipts. While
Transaction Search is pending, say “Fresh Orders and Payouts API reads verify both
receipts; aggregate reporting is still catching up.” Never call that two reporting
matches. A new take with a new purchase must use another buyer-approved sandbox
top-up; preserve the completed ledger. Update the README after V5 actually passes. If a Studio trial or Gemini key becomes available, verify the live
path and only then name it as used in the narration. Keep the total video under
three minutes. Do not splice simulated receipts into a sandbox sequence.
