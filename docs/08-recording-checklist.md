# Recording and release checklist

Target: English desktop demo, 2:50 including all titles and closing frames.
This is a preparation checklist. Unchecked export/upload/form items still require
the actual assets; a script timing estimate is not a measured video.

## Before each take

- [ ] Run `npm test`, `npm run verify:demo` and `npm run verify:recording`.
- [ ] Launch `npm run demo:record`; open its printed URL in Chrome. Confirm MOCK,
  buyer $5.0000, reserved $0.0000, session spend $0.0000 and author $0.0000.
- [ ] Rehearse once: three calls, failure, payout, two matches, actual Gemini chart,
  Page-agent hand-back, receipt resize and themed Grid cells. Then stop that take
  and launch a fresh one. Rehearsal changes stay in its own ignored SQLite file.
- [ ] Confirm active evaluation licenses and Gemini quota. Warm the CDN imports.
  A fallback result is valid product behavior but cannot be narrated as real Gemini.
- [ ] Prepare this prompt in a text editor: “Plot what I paid each calendar day
  during the current month.” Paste into **Studio's AI Assistant** during the take.
- [ ] Pre-authenticate the separate hosted `/reconcile` tab privately. Confirm two
  MATCH rows and explicit fee sources. Leave the completed hosted funds untouched.
- [ ] Use a desktop viewport at least 1440 × 900. At this Mac's display size, Chrome
  80% zoom fits Studio's chat, receipt and chart; verify readable exported text.
  Scroll Studio into view before its scene. At narrow widths its canvas can scroll.
- [ ] Capture app content only. Crop out browser chrome, bookmarks, unrelated tabs,
  extensions, OS notifications and third-party brand artwork. Keep AgentMeter's
  payment-mode badges, source labels and evidence disclosures in frame.
- [ ] Keep API keys, operator sign-in, MCP connection details, private account
  emails, payment payload expanders and secret-bearing terminals out of the take.
- [ ] Test microphone levels. Use English narration/captions/title/description.
  Use no music, stock footage, third-party logos or copyrighted soundtrack.

## During the 170-second sequence

- [ ] Follow [the timed script](01-demo-script.md), including its mock/sandbox transition.
- [ ] Click the three-call button once. Show $4.9700 / $0.0300 and zero reserved funds.
- [ ] Show RELEASED and zero charge for the failure, then the successful mock payout.
- [ ] Show two mock MATCH rows and gross / fee / net; mock fees are illustrative.
- [ ] Submit the prepared question once. Leave the wait visible. Show the actual
  `Gemini · validated intent (gemini-3.5-flash-lite)` source, “Delegated to Page agent”
  and “Handed back”, followed by the generated chart.
- [ ] Select the custom receipt and drag its layout handle. Show actual layout
  movement, then briefly scroll to the themed Grid and its USD/status cells.
- [ ] Switch to the completed hosted sandbox reconciliation for the separate final
  evidence scene. Do not imply that the preceding mock actions caused these receipts.
- [ ] Stop and retake if errors, fallback, private data or unreadable results appear.
  Do not substitute screenshots or speed up model waits to imply instant results.

## Inspect the actual export

- [ ] Play the entire exported file with sound and captions. Text and mode/source
  labels remain readable; no keys, private account details or unrelated marks appear.
- [ ] Measure total duration, including all inserted frames: **less than 180 seconds**.
  Target 170 seconds. If `ffprobe` is installed, use
  `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /absolute/path/demo.mp4`.
- [ ] Verify every narrated outcome is visible and the two payment modes are clear.
- [ ] Upload the inspected English video to YouTube with **Public** visibility;
  test signed-out playback and copy the actual URL into `devpost-submission.md`.
- [ ] Arrange judge access to the currently private source repository and hosted
  operator demo. Never put a shared operator token in public prose or video.
- [ ] Reconnect Devpost and check the live form, required fields, rules and asset
  requirements. The local copy is prepared; this pass could not verify the live form.
- [ ] Review the final form and submit only through a separately authorized step.

## Rehearsal evidence — 2026-10-24

Chrome rehearsal passed on a fresh isolated take: $5 → $4.97, three settled calls,
one zero-charge released call, $0.03 author payout, and two mock reporting matches.
The paraphrase produced a real Gemini response and a Studio chart with Page-agent
delegation and task hand-back. The receipt's layout handle changed its height;
the generated chart used locale-independent numeric axes. The separate Render
reconciliation still showed two actual sandbox MATCH rows with explicit fee sources.
Historical analytics are explicitly synthetic.
This evidence describes a rehearsal, not a recorded/exported/uploaded video.
