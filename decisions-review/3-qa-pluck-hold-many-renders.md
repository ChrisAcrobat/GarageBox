# QA: the flaky pluck hold check is a code fault; the test now checks 128 renders

Importance: 3 – decides how the strum hold of the default guitar sound is tested, and reports it as a sound fault.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
The check "a held E3 stays within 1 dB of its level at 0.1 s for 4 s" in `tests/pluck.test.html` failed about once in 24 runs under load (e.g. −14.8 → −13.8 dB). It is not a timing problem: the note starts at sample 0 in every render. It has two causes:
- Test: the 0.10–0.15 s window sits about 0.55 dB below the 50–100 ms level that the worklet holds (decision 4-pluck-hold-reference-window), so only about 0.45 dB of the 1 dB was left.
- Code: in about 3–5 % of held E3 notes the random noise burst has so little low-harmonic energy that the make-up gain hits its ×4 limit and the note sinks 1–4.6 dB below its reference by 4 s. This contradicts R4.7.2 ("stays at full level") and design 5 ("low and middle notes stay practically steady"). It is reported as a fault for Build 2 (QA report F3).

The single-render check is replaced by 128 held-E3 renders of 4.05 s. Each render must be within 0.75 dB of its own 50–100 ms level at 4.0–4.05 s, and the check name gives the count outside and the worst value. With the current code it fails in almost every run (3–14 renders outside, worst −0.9 to −4.6 dB). With the make-up limit raised as a test (not committed), 6 of 6 runs passed and 300 renders stayed within −0.45 … +0.24 dB. The t60 check still uses one render.

## Why
The noise burst uses `Math.random` inside the worklet, so a test cannot seed it. A fault that hits one note in 30 can only be caught reliably over many renders. 0.75 dB leaves room for the healthy spread (about 0.5 dB at worst in 480 renders) and still catches the fault. The 128 renders take about 3 s.

## Alternatives
- Widen the old check to 1.5 dB. This would hide the fault.
- Rerun on failure. This would hide the fault too.
- 0.5 dB over 96 renders. A fixed worklet failed this 1 run in 5.
- A seeded noise burst. That needs a change in `src/`, which is the developers' job.

## Where
`tests/pluck.test.html` (strum hold section), design 9.2; code fault in `src/js/audio/pluck-worklet.js` (`MAX_MAKEUP`, the noise burst).
