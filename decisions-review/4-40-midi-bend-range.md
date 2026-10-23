# 40. MIDI source honours the bend range

**Decision:** **MIDI source honours the bend range** by setting the synth's bend range to |bendRange| semitones; fade time is not used by the MIDI source (program's own release).

**Why:** 1:1 semitones; tinysynth has no per-note fade.

**Where:** `midi-source.js`.

Milestone: Milestone 4 – highway, settings, whammy/tilt

Importance: 4 – Audible difference between sources when bending/muting.

**Update 2026-10-22 (experiment E approved):** the whammy bend still uses the bend range. Tilt glide (R4.14) is not sent as MIDI pitch bend: it is per-voice extra detune (cents) on the synth's pitched oscillators on top of the channel bend, re-applied after every bend message, so it has no bend-range limit (design 5).
