# Analytics evaluation after trial expiry

Verified locally on November 9, 2026, with Node 26.10.0 and the pinned production
libraries: AG Grid 36.2.0, AG Charts 14.2.0, AG Studio 3.0.0.

## Sponsor guidance

The AG Grid team permits vendor-watermarked Enterprise/Studio evaluation for
this hackathon and does not penalize the watermark or console warning during
judging. [Original sponsor reply](https://discord.com/channels/1491162723361362021/1555253366999752814/1559835236735393864).
This event-specific guidance does not grant a permanent commercial license.

## Behavior

Active keys pass through unchanged. Expired trial keys are omitted from browser
configuration, while their configured analytics modules continue in the vendor's
keyless evaluation mode. No trial key, vendor code, watermark, or warning is
modified or suppressed. Grid-only configuration does not enable Studio by itself.

`AG_ANALYTICS_EVALUATION=1` explicitly enables Grid and Studio without any keys.
With no keys and no evaluation flag, the existing offline table, widget cards,
and CSV remain the default. CDN failure also retains the plain-table fallback.

## Verification

- All 85 Node tests pass, including staggered Grid/Studio expiry, exact expiry
  boundaries, December 16 / January 1 configuration, and HTTP boot configuration.
- A synthetic, already-expired trial fixture (not a vendor key) was supplied to
  an isolated in-memory mock server. The browser received empty license strings
  and enabled evaluation flags.
- In the browser, three mock tool calls produced three settled calls and exactly
  $0.0300 in the AG Grid table and Studio receipt.
- Creating a daily-spend widget completed delegation to the Studio Page agent and
  displayed the resulting grouped column chart using the validated rule parser.
- Separate browser instances verified explicit no-key evaluation initializes
  Studio, and the unconfigured default retains the plain table and widget cards.
- The fresh-process mock smoke check passed, including the $5.00 to $4.97 balance
  change, $0.03 author payout, and two matching mock rail receipts.

These browser checks exercise the same missing-key vendor path used after expiry;
they do not advance the machine clock or claim a future live payment test.
Vendor watermark timing is controlled by the libraries and is not made permanent
by AgentMeter. Gemini credentials were absent in these isolated mock checks.

Devpost remains unsubmitted. The owner requires confirmation before submission.
