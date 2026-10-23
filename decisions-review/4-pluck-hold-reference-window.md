# Pluck strum hold: reference level taken at 50–100 ms, follower 20 ms

Importance: 4 – sound detail, keeps the held level steady.

## Decision
A held pluck voice (R4.7.2) keeps its output at its RMS between 50 ms and 100 ms after the attack (not the first 50 ms as design 5 says). The level follower (one-pole on the square) and the make-up gain are smoothed with 20 ms (design: 50 ms). Make-up is still limited to 1..4; `holdEnd` freezes it and the ring-time loop gain applies again. A `holdEnd` before 100 ms leaves make-up at 1.

## Why
The first 50 ms of a Karplus-Strong note hold the bright noise attack, whose energy share is random per note. With the first 50 ms as reference the held level settled anywhere from 1.5 dB below to 2 dB above the level at 0.1 s (test "a held E3 stays within 1 dB of its level at 0.1 s for 4 s" failed about one run in two). Measuring right after the attack and following faster made six runs in a row pass.

## Alternatives
First 50 ms as designed (flaky, audible level step); a seeded noise burst; a longer reference window (later start of the hold effect).

## Where
`src/js/audio/pluck-worklet.js` (`HOLD_REFERENCE_START`, `HOLD_REFERENCE_SECONDS`, `HOLD_FOLLOW_SECONDS`), design 5 "Pluck hold".
