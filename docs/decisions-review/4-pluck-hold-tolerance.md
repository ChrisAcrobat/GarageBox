# Pluck strum hold: quick-strum check uses a mean and 1 dB

Importance: 4 – the check would fail at random otherwise.

## Decision
"A `holdEnd` at 5 ms renders like a voice without hold" compares the mean of 16 renders each, every level at 0.5–1 s taken relative to the render's own level at 0.05–0.15 s, within 1 dB (design 9.2 said 0.5 dB). The other pluck hold checks stay as designed (held E3 within 1 dB of its 0.1 s level for 4 s; 60 dB in the ring time ±10 % after `holdEnd`, measured from the slope between 4.3 s and 5.0 s with a 1 s ring time; a held voice fades on `noteOff`).

## Why
The Karplus-Strong noise burst is random. Measured with the current worklet, identical renders differ by about 1.6 dB (sd) absolute and 1 dB relative, so a 0.5 dB comparison of two single renders fails about half the time even with no hold at all. With the mean of 16 and 1 dB, six runs in a row of two unheld renders stayed within the tolerance.

## Alternatives
A seeded noise burst (needs a worklet change in src/); compare only the decay slope; keep 0.5 dB and accept flaky CI.

## Where
`tests/pluck.test.html`, design 9.2 (pluck line updated).
