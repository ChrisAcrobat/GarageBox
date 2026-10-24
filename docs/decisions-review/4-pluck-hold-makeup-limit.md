# Pluck strum hold: make-up gain limit raised from x4 to x16 (+24 dB)

Importance: 4 – sound detail; fixes QA F3 (held notes sometimes sink).

## Decision
The make-up gain of a held pluck voice (R4.7.2) is limited to 1..16 (`MAX_MAKEUP = 16`, +24 dB) instead of 1..4. The noise burst stays random and unchanged. Everything else in the hold (50–100 ms reference, 20 ms follower, freeze on `holdEnd`) is as before.

## Why
While the note is held, the loop low-pass removes the upper harmonics, so a note keeps its level only if the make-up gain can replace their energy. When a burst happens to have very little low-harmonic energy, ×4 is not enough and the note sinks. Measured with a Node simulation of the worklet (E3, brightness 0.3, ring time 1 s, 48 kHz, level at 4.0–4.05 s against 0.05–0.10 s):
- ×4: 28 of 500 renders were more than 0.75 dB off, worst −6.6 dB.
- ×8: 1 of 10000 E3 renders and 2 of 2000 dark A3 renders (brightness 0) were still off, worst −2.0 dB.
- ×16: 0 of 10000 E3 renders (worst −0.18 dB) and 0 of 3000 dark A3 renders. At E4 it went from 936 of 2000 off to 16 of 2000.

The make-up gain only fills back towards the note's own reference level, so it never makes a note louder than its 50–100 ms level. Notes played without hold, and their tone, are not changed at all.

In the browser, pluck.test.html (128 renders per run) passed every run after the change; the report gives the count.

## Alternatives
- **Guaranteed low-harmonic energy in the burst** (raise harmonics 1–3 up to a minimum share). Rejected: a typical burst has only about 2 % of its energy in the fundamental, so a floor high enough to cover the tail changed 30–80 % of all bursts. That would change the tone of every pluck, held or not. Lower floors still left failures.
- **Seeded burst.** Rejected: every pluck of a note would sound identical (machine-gun effect), and the test would pass only for the chosen seeds.
- **×8.** Rejected: it still leaves a tail of about 1 in 1000–10000 renders.

## Where
`src/js/audio/pluck-worklet.js` (`MAX_MAKEUP`). Design 5, "Strum hold", still says `clamp(L0 / rms, 1, 4)` and "+12 dB of make-up". It should say 16 and +24 dB. The highest notes still fade slowly while held, just later.
