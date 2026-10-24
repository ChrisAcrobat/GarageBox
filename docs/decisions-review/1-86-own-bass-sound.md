# 86. Own bass sound (R3.4.1)

- **Decision:** Owner chose an own bass sound instead of the plucked string (replaces decision 11). My design: sawtooth + sine one octave down, low-pass with a falling cutoff for a finger "thump" (1200 Hz to a resting cutoff set by the tone setting in about 0.25 s), exponential decay over the ring time, normal Web Audio nodes on the main thread, 24 voices. Bass default source becomes this; pluck and MIDI stay selectable.
- **Rationale:** Rounder and fuller than a low Karplus-Strong string; simple enough without a worklet.
- **Alternatives:** Keep the low plucked string; a worklet-based synth; MIDI Electric Bass (finger) as default.
- **Where:** R3.4.1, R3.5, design 5 (Bass source), `bass-source.js`, `bass.test.html`.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

Importance: 1 – The bass default sound itself; owner chose an own bass sound, the synthesis details are mine.
