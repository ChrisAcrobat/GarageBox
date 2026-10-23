# QA doc change: design 6 no longer says the draw order must be fixed

Importance: 6 – the doc catches up with the code.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
I removed "the current code draws them the other way round and must be fixed" from the highway paragraph in design 6. `drawHighway` sorts the notes by start time and draws the oldest first (R5.4.1; decision 4-highway-edge-and-bend-width). `tests/highway.test.html` now checks the order. This also replaces what decision 2-r541-not-tested says about R5.4.1 having no test. That file stays for the owner.

## Why
The sentence was stale. The fix was made in Build 2.

## Alternatives
None worth keeping.

## Where
docs/design.md 6 (Highway view), 9.2.
