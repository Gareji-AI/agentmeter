# Submission copy review — November 9, 2026

The revised project story is [15-devpost-project.md](15-devpost-project.md).
The [Devpost project page](https://devpost.com/software/agentmeter) is now public.
The revised description, video and links were saved and their public rendering
was checked without signing in. Saving the project published the portfolio page;
the PayPal AI Hackathon entry still has no submitted_at value. Final entry
answers remain local until explicit confirmation of the real submission.

## Editorial changes

- Put the provider and buyer before the implementation details.
- Use first-person singular for an individual entry. Do not invent a team,
  customer interviews, adoption numbers, personal anecdotes, or market forecasts.
- Replace broad phrases such as “inspectable workflow” and “evidence-driven
  iteration” with the actions the application performs.
- Use the approved Devpost-style order: inspiration, behavior, implementation,
  challenges, accomplishments, learning, next steps, testing, and limits.
- Separate the recorded result from current live state. The new payout was
  pending in Transaction Search in the recording; this is not a fresh claim that
  it remains pending today.
- Explain that the video uses existing prepaid credit and does not show a fresh
  top-up. Describe the complete earlier funding test separately from that take.
- Name the filmed Codex model and the narrow verified Gemini use. Explain that
  the custom Studio runner drives Page-agent tools; do not imply another
  independently reasoning model inside the Page agent.
- Say that the mock runs offline after downloading. Cloning itself needs network
  access, and reproducing the licensed Gemini/Studio view needs additional keys.

The body is about 1,160 words. Prose paragraphs are at most 240 characters. These
are readability checks, not a claim about an AI detector or authorship score.

## Official criteria and evidence

Requirements and all 22 field specifications were read from the official Devpost
connection on this review turn, along with all five judging criteria. Every
required answer is present, enum values are valid, and checkbox types are boolean.

| Criterion | Where the story answers it | Evidence / remaining limit |
| --- | --- | --- |
| Technological Implementation | PayPal funding, payout, reporting; Codex MCP calls; Gemini intent; integer ledger | `src/payments.mjs`, `src/metering.mjs`, `src/gateway.mjs`, `src/ai.mjs`; sandbox evidence in docs 06 and 13 |
| Design | Provider publication → buyer key → calls → payout; themed, editable analytics | Working flows and analytics evidence; not just a list of libraries |
| Potential Impact | Developers selling agent tools and buyers limiting per-call spending | Concrete user/problem; no unsupported demand, user counts, or revenue claims |
| Innovation/Idea | Per-call internal credit linked to provider earnings and separate PayPal records | Describe this implementation; make no “first” or competitor superiority claim |
| Presentation | One provider, three calls, $0.03 payout, real analytics, linked short video | 168.533-second published video; continuous CLI interval and synthetic-history labels documented |

## Sponsor fit

The [official AG Grid page](https://paypalaihackathon.devpost.com/details/aggrid)
asks for custom widgets, theming, layout tools, and an Agent Framework integration.
The story names each implemented part and explains the custom runner. Source:
`src/public/studio.js`, with browser verification in docs 04 and 05.

The [official APIMatic page](https://paypalaihackathon.devpost.com/details/apimatic)
describes Context Plugin use in the coding workflow. The response says which
installed guidance was read and which SDK details were inspected. It does not
claim the Server SDK is a runtime dependency or assert measured time savings.

Sponsor eligibility and awards remain the organizers' decision; this review is
a mapping of published criteria to the submitted claims, not their approval.

## Discord research: hackathon evaluation after trial expiry

Grid/Charts expires November 23 and Studio December 8, before judging ends.
The core no-key mock, table, CSV, and rule widgets work independently of those
licenses, but they do not reproduce every part of the recorded Studio workflow.
The story and judge instructions now say this explicitly.

Read the PayPal Developer server's AG Grid channel on November 9. Searches for
`in:ag-grid trial` and `in:ag-grid watermark` returned 8 and 14 results respectively.
The surrounding replies give an existing answer to the extension question:

- [JamesSwinton, October 14](https://discord.com/channels/1491162723361362021/1555253366999752814/1559835236735393864): Studio can show a watermark and console error; these will not be penalized during judging.
- Sylwia Vargas, October 19, in the same channel: Enterprise libraries continue
  working with a watermark after the 30-day / Studio 45-day evaluation period.
- Sylwia Vargas repeated on November 2 that Enterprise without a key is acceptable
  for the hackathon with a watermark. November 3–4 replies reinforce that guidance.

These are event-specific sponsor statements, not a permanent commercial license
or evidence that the existing trial dates were extended. No extension request is
needed before testing the sponsor-described watermark path.

The original application disabled Studio after filtering expired trial keys.
At the owner's subsequent request, this was fixed: analytics stay enabled in the
vendor's keyless evaluation mode while expired keys remain omitted. Local browser
checks verified Grid totals, Studio receipts and delegated chart creation with
expired synthetic fixtures; 85 automated tests pass. See
[the implementation and verification notes](18-analytics-evaluation.md).

An extension request draft remains under ignored `data/submission/`. The owner
explicitly paused sending and requested this research. No message has been sent;
fresh confirmation is required before any future message or final submission.

Purchasing Grid/Charts alone would not cover Studio. The current [pricing page](https://www.ag-grid.com/studio/license-pricing/)
lists Studio separately with tailored subscription pricing. Buying a license is
not the next step for this hackathon based on the sponsor's existing guidance.

## Submission readiness

Public MIT repository, public video, thumbnail, core mock instructions and form
answers are prepared. The subsequent analytics fix passed 85/85 tests and local
browser checks. The participant confirmed rules review. Final submission approval
is still required; no Discord message or Devpost submission has been sent.

The fix was merged as [PR #4](https://github.com/Gareji-AI/agentmeter/pull/4),
commit `8836e8f6cbdb18b1703160343ba8ac1fb6ffd13d`, and deployed to the existing
Render service as `dep-dbotbr61egvs73819e0g` on November 9. Post-deploy checks
verified a new process identity, unchanged ledger identity, four reporting
matches, enabled authenticated Studio configuration, and deployed browser assets
matching the verified source. The native browser's hosted view required operator
login; authenticated hosted checks used the existing private token over HTTPS.
The interactive expired-trial checks were local isolated mocks, as stated above.
