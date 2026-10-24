# QA: accept the MIDI sustaining program list and write the numbers into the design

Importance: 4 – decides which MIDI trails stay at full opacity (R4.7, R5.4.2).

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
I accept the list from decision 3-midi-sustaining-programs: GM programs 16–23, 40–44, 48–54 and 56–95 (counted from 0) sustain, and every other melodic program decays, including 45 pizzicato, 46 harp, 47 timpani and 55 orchestra hit. Design 5 "Tracker" now names these numbers next to the families. That decision file stays for the owner's review.

## Why
The list follows the GM families that design 5 already names. The four exceptions are plucked or struck, so they die away and do not sustain. The tests already check an organ (19) that sustains and the guitar (27) that decays. Writing the numbers into the design makes the decided behaviour checkable.

## Alternatives
- Leave the design at family names only. This is ambiguous for 45–47 and 55.
- Ask the owner first. The run is unattended, and the list is easy to change.

## Where
docs/design.md 5 ("Tracker", the level estimate paragraph); `src/js/audio/audio-engine.js` `isSustainingProgram`.
