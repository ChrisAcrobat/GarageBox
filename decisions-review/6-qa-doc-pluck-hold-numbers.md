# QA doc change: design 5 pluck hold uses the built numbers

Importance: 6 – the doc follows a sound detail that was already decided.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
The pluck hold paragraph in design 5 now gives these numbers, as built and logged in decision 4-pluck-hold-reference-window:
- the reference RMS is taken from 50 to 100 ms (not the first 50 ms);
- the follower and the make-up smoothing use 20 ms (not 50 ms);
- a `holdEnd` within the first 100 ms (not 50 ms) leaves the make-up at 1.

## Why
The design described the old numbers, which the bot had to change to make the hold steady. The decision file stays for the owner's review.

## Alternatives
Leave the design as it was until the owner has reviewed the decision. That would leave the design wrong about the code in the meantime.

## Where
docs/design.md 5 (Pluck source, strum hold).
