# Bass source: tone mapping, level and voice handling

Importance: 4 – sound details, starting points to tune by ear.

## Decision
- Tone: the resting cutoff is interpolated linearly between the design's four values by the tone setting's brightness value (0.15 → 250 Hz, 0.35 → 400, 0.55 → 600, 0.85 → 900; clamped outside). The bass source gets the tone and ring time as set (no ×0.6 darkening and no ×1.5 ring time; those stay for a bass on the plucked string, as the guitar test expects 15 s there).
- Level: peak voice gain 0.4 × velocity/127 (sawtooth + sine at 50 % through the low-pass; a single A2 at velocity 100 measures about −14 dB RMS, no clipping).
- Thump: cutoff 1200 Hz, then `setTargetAtTime` to the resting value with τ 0.08 s (≈ 0.25 s to settle).
- Voices beyond 24 and a repeated voice id are dropped with a 10 ms linear fade. A decaying voice's oscillators stop at −80 dB below its peak; `noteOff` computes the current level from the schedule (no `cancelAndHoldAtTime`, which Firefox lacks), then fades linearly and stops.
- `holdEnd` during the 5 ms attack re-adds the attack's end point before the decay so the attack is not lost (`cancelScheduledValues(t)` would otherwise remove it).

## Why
Design 5 gives the cutoffs per tone name only and leaves the level open. The other values follow the design's "about" numbers.

## Alternatives
Snap to the nearest tone name; reuse the pluck bass's ×0.6/×1.5 adjustments (design says default 10 s for the bass too).

## Where
`src/js/audio/bass-source.js`, `src/js/instruments/setup.js` (`guitarSound`); design 5 "Bass source", R3.4.1.

Note for review: the strum-hold level check in tests/bass.test.html passes at −14.5 → −14.0 dB against a 0.5 dB tolerance. The output is steady (no gain change while held); the difference comes from 50 ms RMS windows over a 41 Hz (sub-octave) waveform, so a different browser could land just outside.
