# Measures and thresholds of the bass and effects pages

Importance: 3 – thresholds the sound code has to meet; the design gives only the behaviour.

## Decision
- Bass: A2 (110 Hz) is played; with the sub sine an octave down the waveform repeats at 55 Hz, so the pitch check accepts a period of 110 Hz or 55 Hz. The thump is "first-difference energy over 0.01–0.06 s greater than over 0.35–0.40 s". The held level is measured from 0.5 s (after the filter sweep) to 4.0 s, within 0.5 dB. Voice limit: 25 voices, then 24 muted; silence afterwards means the oldest was dropped. Bend −12 halves the measured period (±3 %).
- Effects: Clean passes a 220 Hz sine at its input level ±0.5 dB with a 3rd harmonic below 0.1 %; Crunch adds a 3rd harmonic above 3 % and Epic more; level match within 6 dB of Clean; after a 10 ms burst Clean has no tail, Crunch a reverb tail, Epic more energy at 0.37–0.40 s than at 0.32–0.35 s (echo) and a longer tail than Crunch; switching Clean → Crunch while sounding keeps sound.
- The measures were tried against small throwaway implementations written to design 5 (not committed): the bass page passed every sound check and the effects page every check except level match, which depends on the real gains.

## Why
Offline renders are deterministic for these node graphs, so simple windowed measures are enough and stay readable.

## Alternatives
FFT-based spectra; reference recordings (none exist, and the numbers are still to be tuned by ear).

## Where
`tests/bass.test.html`, `tests/effects.test.html`, `tests/offline-audio.js`.
