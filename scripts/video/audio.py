#!/usr/bin/env python3
"""Make replaceable, offline demo audio. Video tooling only, never app runtime.

Requires macOS `say`, ffmpeg, numpy/scipy/soundfile/pyloudnorm and the MIT Earshot
source checkout pinned in the generated manifest. No model download or API call.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

SR = 48000
# Sentence starts follow the actual visible actions, rather than reading a whole
# chapter before its UI catches up. Values are seconds relative to each chapter.
SENTENCE_STARTS = {
    'overview': [0.18], 'publish': [0.3, 13.9, 24.4], 'buyer': [0.3, 6.4],
    'calls': [0.3, 8.9, 20.5], 'after': [0.3, 4.5, 7.8],
    'payout': [0.3, 6.7, 10.0, 13.5, 19.7],
    'reconcile': [0.3, 3.7, 6.2, 11.4],
    'analytics': [0.3, 4.7, 10.2, 26, 30.2, 32.1],
    'close': [0.3, 1.1, 2.1, 4.7],
}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'


def level(audio, target):
    loudness = pyln.Meter(SR).integrated_loudness(audio)
    out = audio * 10 ** ((target - loudness) / 20)
    return out * min(1, 0.88 / max(np.max(np.abs(out)), 1e-9))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--earshot', type=Path, required=True)
    parser.add_argument('--plan', type=Path, default=Path(__file__).resolve().parents[2] / 'docs/video/demo-plan.json')
    args = parser.parse_args()
    sys.path.insert(0, str(args.earshot.resolve()))
    from earshot.forge import bank, dsp

    args.out.mkdir(parents=True, exist_ok=True)
    work = args.out / 'voice-parts'
    work.mkdir(exist_ok=True)
    plan = json.loads(args.plan.read_text())
    duration = plan['target_seconds']
    length = round(duration * SR)
    voice = np.zeros((length, 2), dtype=np.float32)
    music = np.zeros_like(voice)
    effects = np.zeros_like(voice)
    subtitles, voice_log, effect_log = [], [], []

    def place(dst, audio, start, gain=1, pan=0):
        audio = np.asarray(audio)
        if audio.ndim == 1:
            audio = np.column_stack((audio * np.sqrt((1 - pan) / 2), audio * np.sqrt((1 + pan) / 2)))
        offset = round(start * SR)
        if offset < 0:
            audio, offset = audio[-offset:], 0
        count = min(len(audio), len(dst) - offset)
        if count > 0:
            dst[offset:offset + count] += audio[:count] * gain

    # Say each sentence separately so caption timing follows actual rendered speech.
    # Samantha is a generic installed voice, never a clone of the participant.
    for scene in plan['scenes']:
        sentences = re.split(r'(?<=[.!?])\s+', scene['narration'])
        parts = []
        available = scene['end'] - scene['start'] - 0.45
        rate = max(156, round(len(scene['narration'].split()) / available * 60 * 1.2))
        for i, sentence in enumerate(sentences):
            stem = work / f'{scene["id"]}-{i:02}'
            run('/usr/bin/say', '-v', 'Samantha', '-r', str(rate), '-o', str(stem.with_suffix('.aiff')), sentence)
            run('ffmpeg', '-v', 'error', '-y', '-i', str(stem.with_suffix('.aiff')), '-ar', str(SR), '-ac', '1', str(stem.with_suffix('.wav')))
            samples, _ = sf.read(stem.with_suffix('.wav'), dtype='float32')
            # Trim only digital silence at the outer edges; preserve natural pauses.
            active = np.flatnonzero(np.abs(samples) > 0.002)
            if len(active):
                samples = samples[max(0, active[0] - 900):min(len(samples), active[-1] + 1800)]
            parts.append((sentence, samples))
        gap = 0.14
        spoken = sum(len(x) / SR for _, x in parts) + gap * (len(parts) - 1)
        # A per-chapter fit guard fails instead of letting narration cross a cut.
        if spoken > available:
            raise ValueError(f'{scene["id"]}: speech {spoken:.2f}s exceeds {available:.2f}s; increase say rate')
        cursor = scene['start'] + 0.18
        starts = SENTENCE_STARTS[scene['id']]
        if len(starts) != len(parts):
            raise ValueError(f'Update sentence cues for changed copy: {scene["id"]}')
        for i, (sentence, samples) in enumerate(parts):
            cursor = scene['start'] + starts[i]
            limit = scene['start'] + starts[i + 1] if i + 1 < len(starts) else scene['end']
            if cursor + len(samples) / SR > limit:
                raise ValueError(f'Overlapping speech cue: {scene["id"]} sentence {i}')
            samples = level(samples, -19)
            place(voice, samples, cursor, gain=np.sqrt(2))
            words = sentence.split()
            groups = [words[i:i + 9] for i in range(0, len(words), 9)]
            # Caption windows are anchored to the measured sentence waveform.
            elapsed = 0
            weights = [sum(len(w) + 1 for w in g) for g in groups]
            for group, weight in zip(groups, weights):
                seconds = len(samples) / SR * weight / sum(weights)
                subtitles.append((cursor + elapsed, cursor + elapsed + seconds, ' '.join(group)))
                elapsed += seconds
            voice_log.append({'scene': scene['id'], 'start': cursor, 'end': cursor + len(samples) / SR, 'text': sentence, 'rate': rate})
            cursor += len(samples) / SR + gap
        print(f'{scene["id"]}: {spoken:.2f}s / {available:.2f}s, {rate} wpm', flush=True)

    # Original restrained instrumental score: Dmaj9 / Bm7 / Gadd9 / Asus.
    # All oscillators, rooms and tuned mallets are computed by Earshot, no samples.
    tempo = 80
    beat = 60 / tempo
    chords = [[50, 57, 61, 64], [47, 54, 57, 62], [43, 50, 57, 59], [45, 52, 57, 62]]
    def hz(note):
        return 440 * 2 ** ((note - 69) / 12)
    for bar, start in enumerate(np.arange(0, duration, 8 * beat)):
        chord = chords[bar % len(chords)]
        seconds = min(8 * beat + 1.0, duration - start)
        t = np.arange(round(seconds * SR)) / SR
        envelope = np.minimum(1, t / 0.6) * np.minimum(1, np.maximum(0, seconds - t) / 1.1)
        pad = np.zeros_like(t)
        for note in chord:
            pad += (dsp.osc(hz(note), seconds=seconds) + 0.18 * dsp.osc(hz(note) * 2.001, seconds=seconds)) / len(chord)
        pad *= envelope * (0.92 + 0.08 * np.sin(2 * np.pi * 0.12 * t))
        place(music, dsp.room(pad, dsp.rng(100 + bar), rt60=0.65, wet=0.2), start, 0.08, pan=(-0.2 if bar % 2 else 0.2))
        for j, step in enumerate([0, 2, 3.5, 6]):
            note = chord[[1, 2, 3, 2][j]] + 12
            take, _ = bank.render('mallet/pluck', seed=20261025 + bar * 4 + j, pitch=hz(note), peak_db=-7)
            place(music, take, start + step * beat, 0.027 if j != 2 else 0.02, pan=[-0.25, 0.2, -0.1, 0.3][j])
    music = level(music, -31)
    fade = np.minimum(1, np.arange(length) / (SR * 1.2)) * np.minimum(1, (length - 1 - np.arange(length)) / (SR * 2.0))
    music *= fade[:, None]
    # Continuous speech-aware ducking, with slow release and no pumping at syllables.
    hop = SR // 50
    rms = np.sqrt(np.mean(voice.reshape(-1, hop, 2) ** 2, axis=(1, 2)))
    activity = signal.convolve((rms > 0.008).astype(float), np.ones(31) / 31, mode='same')
    duck = np.interp(np.arange(length), np.arange(len(rms)) * hop, np.clip(activity, 0, 1))
    music *= (10 ** (-5 * duck / 20))[:, None]

    # Sparse editorial accents, never counterfeit app/PayPal feedback.
    cues = [(0.15, 'mallet/celesta', -24), (6, 'ui_pop/soft', -25), (36, 'ui_pop/step', -27),
            (46, 'ui_pop/soft', -27), (72, 'mallet/pluck', -24), (82, 'ui_pop/soft', -27),
            (94.1, 'mallet/celesta', -26), (104, 'ui_pop/soft', -28),
            (120, 'ui_pop/step', -26), (146, 'ui_pop/soft', -28), (156, 'mallet/celesta', -24)]
    for i, (at, sound, db) in enumerate(cues):
        take, meta = bank.render(sound, seed=25 + i, pitch='D5' if sound.startswith('mallet/') else None, peak_db=-1)
        if not meta['checks']['ok']:
            raise ValueError(f'Effect audit failed for {sound}: {meta["checks"]}')
        sf.write(args.out / f'sfx-{i:02}.wav', take, SR, subtype='PCM_24')
        place(effects, take, at - meta['onset_s'], 10 ** (db / 20))
        effect_log.append({'cue': at, 'sound': sound, 'gain_db': db, 'audit': meta})

    mix = voice + music + effects
    mix = level(mix, -18)
    # Preserve stems at their mix gain so they recombine to the delivered mix.
    gain = np.sqrt(np.sum(mix ** 2) / max(np.sum((voice + music + effects) ** 2), 1e-20))
    meter = pyln.Meter(SR)
    measures = {}
    for name, data in [('narration', voice * gain), ('music', music * gain), ('sfx', effects * gain), ('mix', mix)]:
        sf.write(args.out / f'{name}.wav', data, SR, subtype='PCM_24')
        measures[name] = {'seconds': len(data) / SR, 'lufs': float(meter.integrated_loudness(data)), 'sample_peak_dbfs': float(20 * np.log10(max(np.max(np.abs(data)), 1e-9))), 'clipped_samples': int(np.count_nonzero(np.abs(data) >= 1))}
    srt = '\n\n'.join(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}' for i, (a, b, text) in enumerate(subtitles, 1)) + '\n'
    (args.out / 'narration.srt').write_text(srt)
    revision = run('git', '-C', str(args.earshot), 'rev-parse', 'HEAD').strip()
    manifest = {'duration': duration, 'sample_rate': SR, 'voice': 'macOS Samantha; generic synthetic temporary narrator, replace with participant recording', 'no_voice_clone': True, 'earshot': {'url': 'https://github.com/Leonxlnx/earshot', 'revision': revision, 'license': 'MIT', 'bank': bank.VERSION}, 'music': {'title': 'Metered steps', 'tempo': tempo, 'composition': 'Original procedural instrumental composed for AgentMeter, Earshot DSP and synthesized mallets; no recordings or existing song'}, 'voice_sentences': voice_log, 'editorial_sound_cues': effect_log, 'measurements': measures, 'files': {name: hashlib.sha256((args.out / name).read_bytes()).hexdigest() for name in ['narration.wav', 'music.wav', 'sfx.wav', 'mix.wav', 'narration.srt']}}
    (args.out / 'audio-manifest.json').write_text(json.dumps(manifest, indent=2, default=lambda x: x.item() if isinstance(x, np.generic) else str(x)) + '\n')
    print(json.dumps(measures, indent=2))


if __name__ == '__main__':
    main()
