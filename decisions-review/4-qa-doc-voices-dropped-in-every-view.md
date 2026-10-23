# QA doc change: silent voices are dropped in both views and for every channel

Importance: 4 – states the behaviour that fault F1 breaks.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
Design 5 used to say only "Voices below 2 % are dropped". It now adds that this happens for every channel, including drums and the keyboard's drum channel, and in both views. The highway view on its own must drop silent voices too, so that its notes end (R5.4.2).

## Why
Today only the simple view drops voices (`VoiceTracker.active()` is called only from `drawSimpleView`, and only for the guitar and keys lanes). In the highway view no note of a melodic sound ever ends (QA fault F1), and drum voices are never dropped in either view. The design did not say where the dropping must happen. This sentence makes the decided behaviour of R5.4.2 explicit, so the fix and the test (`tests/highway.test.html`) have something to point to.

## Alternatives
Leave the design as it was and describe the fault only in the QA report.

## Where
docs/design.md 5 (level estimate paragraph).
