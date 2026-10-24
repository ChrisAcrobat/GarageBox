# QA: bass hold check measures whole periods; tolerance stays 0.5 dB

Importance: 5 – test detail, no change to the sound.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
The bass strum hold check in `tests/bass.test.html` now measures both levels over 8 whole periods of the lowest partial, the 41.2 Hz sub-octave of E2, which is 0.194 s. One window starts at 0.5 s and the other ends at 4.09 s, just before the `holdEnd` at 4.1 s. The tolerance stays 0.5 dB. Measured: −14.34 → −14.34 dB (the old 50 ms windows gave a gap of about 0.5 dB, right at the limit).

## Why
The held bass output is steady. The gap came from the 50 ms windows, which cover only about 2 periods of the 41.2 Hz sub-octave, so the RMS depended on where a window cut the wave. With whole periods the margin is real, and a 0.5 dB loss is still caught.

## Alternatives
- Widen the tolerance to 1 dB. A real loss would then go unnoticed longer.
- Use longer arbitrary windows. These are less exact than whole periods.

## Where
`tests/bass.test.html` (strum hold section), design 9.2.
