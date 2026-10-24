# AgentMeter UI refinement — 2026-10-24

Open Design 0.19.1 was used over its local MCP interface to review and refine all
five workspaces. Project: `agentmeter-demo-design-20261024` (AgentMeter Demo Design).
Design run: `b4f5abe4-3a22-4806-9ff8-838407802ce9`, completed successfully.

Sanitized SSR mock screens and the existing stylesheet were supplied as references.
No app credentials, real account data, or local ledger files were sent into the
design project. The Open Design `impeccable-design-polish` workflow produced
`refined.html`, `design.css`, and `implementation-notes.md`. The MCP artifact bundle
was retrieved and reviewed before the visual system was adapted to this repository.
The reference preview contains fixed illustrative fixtures; its handlers are not
part of the running product.

## What changed and why

- **Hierarchy:** a 52px desktop available balance leads each money workspace, with
  quieter reserved/spend figures. Body text is 15px and working labels 13–14px.
  The mock-mode badge is more prominent. System fonts keep the app offline-capable.
- **Buyer:** the tool/result panel and live receipts sit side by side. Before the
  change, the receipt table started around y=956 in a 1440×900 viewport; afterward
  it starts around y=611. Three settled receipts fit in the initial recording view.
- **Provenance:** seeded call and payout history has its own labelled disclosure.
  SSR and live refresh both exclude `seed_` records from current receipt panels;
  grouping does not guess provenance from a record's date.
- **Provider:** available earnings, current payout receipts and live call evidence
  precede aggregate or synthetic history. The actual payout handler and reservation
  rules remain in place.
- **Reconciliation:** count, state, heading and explanatory text derive from returned
  rows. Missing reports and stored-only receipts stay pending. Mismatches receive
  a review state. No static “Balanced” label stands in for receipt verification.
- **Analytics:** widget creation comes first, with an intentional explanation of the
  license-free view. Existing local charts, card movement, CSV and optional adapters
  remain available. No date-based provenance filter from the prototype was copied.
- **Navigation:** a compact forest sidebar and linked money trail connect spend,
  earnings and reconciliation. A small meter mark replaces the old letter monogram.
- **Accessibility:** named keyboard-focusable table regions own overflow, column
  headers have scope, history uses native disclosures, focus is visible, and
  reduced-motion preference disables transitions. There is no root overflow hiding.

Money still comes from the existing integer ledger and formatting functions.
Production APIs, real sandbox proof, model usage and licensed Studio status are not
changed or implied by the new appearance. The original API routes, authorization,
idempotency, budgets, capture and payout handling are retained.

## Verification

- `npm test`: 40 passing tests, including same-date synthetic/live separation and
  pending/mismatch/matched reconciliation presentation.
- `npm run verify:demo`: fresh-process seed and the exact $5 → $4.97 → $0.03 author
  payout → two mock receipt matches flow.
- Browser: new mock ledger, three calls and actual results, released/zero-charge
  failure, zero monthly cap stopping a call, restored cap, payout success, refreshed
  two-row reconciliation, rule-parser widget creation/movement and CSV download.
- Browser mobile: all five routes at 390px had page width equal to viewport width.
  Order creation did not credit funds; approval/capture added the selected $1 once.
- Desktop: 1440×900 layout and all three recent settled receipts inspected.
- Gemini and licensed Grid/Studio remain unverified without their keys, as documented
  in the README. This is a design refinement, not new sandbox evidence.
