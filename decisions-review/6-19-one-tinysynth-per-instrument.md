# 19. One tinysynth instance per instrument

**Decision:** **One tinysynth instance per instrument (pooled)** instead of one shared synth with 16 channels.

**Why:** A shared instance has one output, so per-instrument gain/volume (design 5) would not work.

**Alternatives:** Shared instance + CC7 volume.

**Where:** `midi-source.js`.

Milestone: Milestone 3 – more instruments

Importance: 6 – Enables per-instrument volume; affects CPU but players hardly notice.
