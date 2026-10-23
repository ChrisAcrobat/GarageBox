# 39. Bend and volume apply to the whole instrument

**Decision:** **Bend and volume apply to the whole instrument** (all ringing notes bend together), as in design 4.1.

**Why:** Like a real whammy bar.

**Alternatives:** Per-note bend.

**Where:** `audio-engine.js`, `pluck-worklet.js`.

Milestone: Milestone 4 – highway, settings, whammy/tilt

Importance: 3 – Audible with chords, but matches a real whammy bar.

**Update 2026-10-22 (experiment E approved):** bend and volume come only from the whammy now and still apply to the whole instrument. The tilt never bends or changes volume. The optional tilt glide (R4.14) is the exception that is per voice: each ringing note gets its own `glide` offset (a chord keeps the scale's shape), on top of the whole-instrument bend.
