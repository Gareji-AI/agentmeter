# Narrated provisional demo and original sound

The 2026-10-25 edit uses the complete 162-second retake described in
[the evidence record](13-full-demo-retake.md). The real participant's face and
voice can replace the temporary narrator later. This is a local review edit,
not a published YouTube video or a submitted Devpost entry.

## Editing and source boundaries

Open Design MCP commissioned a dedicated local project,
`agentmeter-film-20261025`. Its editable composition uses a forest/cream chapter
header, restrained progress motion and a separate English caption band. The
existing editorial header is replaced; app pixels and receipts are preserved.
The official CLI footage at 0:46–1:12 remains continuous, in order and at 1×.
No additional tool purchases, sandbox payouts or top-ups were needed for editing.

The underlying recording still shows $4.91 → $4.88 buyer credit, $0.03 earnings
for the same newly registered provider, and that provider's successful sandbox
payout. Fresh API verification and pending Transaction Search reporting remain
separate. Historical analytics are synthetic; the analysis does not move funds.

## Offline sound production

[Earshot 0.4.0](https://github.com/Leonxlnx/earshot), revision
`591fa3e028032e6dce56620a20e932e35667e8d8`, supplies the MIT-licensed synthesis
code. No reference recordings, downloaded tracks, model weights, remote audio
services or user voice cloning are used.

- **Temporary narration:** installed macOS Samantha English voice, rendered per
  sentence with `say`. Sentence cues follow the actual on-screen actions. Generic
  synthetic voice; it does not represent the participant's recorded performance.
- **Original score, “Metered steps”:** an 80 BPM Dmaj9 / Bm7 / Gadd9 / Asus
  progression, computed with Earshot oscillators, rooms and tuned `mallet/pluck`
  voices. The score fades at the ends and ducks under speech.
- **Eleven editorial accents:** Earshot `ui_pop/soft`, `ui_pop/step`,
  `mallet/pluck` and `mallet/celesta`. Every selected take passes Earshot's
  model-free audit. These are editing accents, not sounds emitted by the product.
- **Separate stems:** `narration.wav`, `music.wav`, `sfx.wav`, `mix.wav` and a
  voice-free `music-sfx.wav`; stereo, 48 kHz, 24-bit PCM, 162 seconds each.

The original WAV mix measures −18.0 LUFS integrated and −5.3 dBTP with zero
clipped samples using Earshot. The ducked music stem is about −35 LUFS. The
manifest retains voice cues, effect seeds/audits, source revision and SHA-256
hashes; the MIT notice is included with the local audio assets. A local video-tool
environment holds the optional Python dependencies. The application remains
dependency-free and does not import these editing tools.

## Reproduce the sound

Use a separate virtual environment with Python 3.12, numpy, scipy, soundfile,
soxr, pyloudnorm, librosa, scikit-learn, Pillow and matplotlib. Rendering the
selected Earshot bank sounds needs no Torch or model download. On macOS with
ffmpeg and the pinned Earshot checkout:

```sh
python scripts/video/audio.py --earshot /path/to/earshot --out /path/to/film/assets
```

The renderer rejects narration that crosses the next sentence/chapter cue and
rejects an effect whose audit fails. It generates 44 measured English caption
windows plus an audio manifest. Floating point is used for audio samples only;
the monetary ledger and its integer arithmetic are unchanged.

## Local handoff

The working folder is `~/Movies/AgentMeter-provisional-2026-10-25/`.
Its `delivery/` folder contains the narrated MP4, an editable Open Design source
archive, review images, a QA report and an offline Chrome preview player.
`presenter-cues.md` contains the English lines at measured cue times. The original
silent retake and raw captures remain in their existing 2026-10-24 folder.
Keep large media outside Git. Use the separate voice-free bed when replacing the
temporary narrator, and review caption timing again for the actual performance.

For the real presenter, record clean voice without baked-in music. A separate
face camera at 1080p/30 fps can be positioned per scene so balances, receipt rows,
CLI output and Studio delegation remain visible. Public upload and submission
remain separate steps.

## Export verification

Open Design exported H.264/AAC at 1920×1080, 30 fps, exactly 162.000 seconds and
4,860 frames, with nine chapter markers and 44 captions. Full video/audio decode
completed with no errors. All 4,860 UI frames were compared at the same source
timestamps: mean SSIM 0.98278, minimum 0.97882; the continuous 780-frame CLI
interval measured 0.98433 mean SSIM. Scaling and encoding account for expected
pixel differences. The original silent master hash remains unchanged.

AAC output retains −18.0 LUFS / −5.3 dBTP and has 0.999995 correlation to the
supplied mix after decode. Caption cards fit within two lines in the separate
lower band. Opening, CLI, payout success, pending reconciliation and analytics
frames were reviewed. The archive's integrity check passed. Application tests
remain green at 82/82, and the script/time-budget check passes.

Chrome completed the entire exported movie with audio enabled, displaying
`Completed · 162.0 / 162.0 seconds · Audio on · 1920 × 1080`. A cropped browser
screenshot is retained with the local delivery, excluding personal browser chrome.
