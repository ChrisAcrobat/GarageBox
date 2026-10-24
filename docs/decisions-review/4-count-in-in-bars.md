# F13 count-in measured in bars, default 1, selectable 0/1/2/4

Importance: 4 – owner decision (Christoffer), replaces the fixed 3-second count-in.

**Decision:** (F13.2, F13.3, F13.4, F13.8; design 13.1)
- The count-in is a whole number of bars at the BPM and time signature chosen in the record dialog, not seconds: one drumstick (GM 31 Sticks) hit per beat, starting at *Start* (1 bar = 4 hits in 4/4, 3 in 3/4).
- Record dialog gets *Count-in* (sv "Inräkning"): None / 1 bar / 2 bars / 4 bars (sv Ingen / 1 takt / 2 takter / 4 takter), default 1 bar, remembered for next time like the other settings (`recordCountInBars`).
- 0 bars: no drumsticks; the metronome starts at once on beat 1.
- The metronome starts exactly on beat 1 of the first bar after the count-in. Recording still starts when the count-in starts.
- Data model: `countInBars` replaces `countInSec: 3`; `countInSec` is derived.

**Reason:** one bar is the standard in DAWs like GarageBand, Logic and Ableton, with two as an option; a count-in that follows the tempo makes the metronome land exactly on beat 1 (a fixed 3 s does not divide into whole beats at most tempos).

**Alternatives:** keep 3 seconds (beats would not line up); fixed 1 bar with no choice.

**Where:** requirements F13.2, F13.3, F13.4, F13.8 (trim example); design 13.1 (data model, recording, record dialog setting and text keys).
