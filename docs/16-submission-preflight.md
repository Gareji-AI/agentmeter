# Submission preflight — November 9, 2026

The official Devpost connection confirmed an existing registration and empty
project 1536626 for PayPal AI Hackathon. No final submission has been performed.
The owner authorized public release of Gareji-AI/agentmeter in this chat.

## Verification

- Node.js 26: all 82 tests pass.
- `npm run verify:demo`: fresh process, screens/assets, $5 → $4.97,
  $0.03 simulated payout, two mock receipt matches.
- `npm run verify:recording`: historical 162-second source plan passes.
  The final presenter export is independently measured at 168.533 seconds,
  1920×1080, H.264/AAC; it is not the historical plan's exact duration.
- Hosted `/health` and `/join`: HTTP 200. Hosted accounts start with zero credit.
  Full free judging is available through the no-key offline mock instructions.
- Public video: https://youtu.be/5jLyQqJBsPA. YouTube's upload workflow reported
  copyright checks complete with no issues and confirmed publication.

## Release audit

Scanned all 326 distinct historical Git blobs and commit messages for common
OpenAI, GitHub, Slack, AWS, Google API, JWT, private-key and embedded AG license
patterns. No high-confidence credential pattern was found. Generic assignment
matches are test fixtures and the scoped loopback recording configuration.
This is a pattern audit, not a guarantee that every possible secret format is detected.

No `.env`, PEM, SSH private-key, SQLite, or ignored evidence archive is tracked.
The real local `.env` is ignored and stays outside the public source. Generated
submission API payloads remain under ignored `data/submission/`; they are not
part of the public application. Unrelated untracked recording helpers are excluded
from the release commit.

## Presentation

Project story: [15-devpost-project.md](15-devpost-project.md).
Cover: [AgentMeter thumbnail](assets/agentmeter-thumbnail-v1.png).
The cover was generated with the built-in image generation tool from the actual
published demo's analytics frame. Its synthetic-history label and sandbox badge
preserve the scope of the demonstrated data. It is presentation artwork, not a
replacement for the working demo or a claim of production payment support.

Public project pages reviewed for presentation structure: [Judge Pay](https://devpost.com/software/judge-pay)
and [IntentShield](https://devpost.com/software/intentshield). Their text and artwork
are not used in AgentMeter's assets or implementation.

The Grid/Charts and Studio trials end before the judging period ends. The submitted
story states these dates and the available table/CSV/rule fallback explicitly.
Pending Transaction Search records remain described as pending.
