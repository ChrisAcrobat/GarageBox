# R5.4.1 has no logic test

Importance: 2 – one requirement is only checked by eye.

## Decision
No test page covers R5.4.1: the highway's look has no pure helper (it is drawn straight to the canvas in `highway-view.js`). R5.4.2 is covered through `VoiceTracker` and `HighwayState` in `guitar.test.html`.

## Why
Testing canvas pixels would be brittle; the task asked for R5.4.1 only if a testable helper exists.

## Alternatives
Pixel snapshots of the canvas; asking the developers for a helper first.

## Where
Design 9.2 ("Also covered").
