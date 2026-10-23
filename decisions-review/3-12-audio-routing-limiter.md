# 12. Audio routing with master gain and limiter

**Decision:** **Audio routing: channel gain -> master gain 0.8 -> DynamicsCompressor (threshold −10 dB, ratio 8) -> output**.

**Why:** Design 5 "light limiter".

**Alternatives:** No limiter.

**Where:** `audio-engine.js`.

Milestone: Milestone 2 – guitar sound

Importance: 3 – Shapes overall loudness and how hard several players get squashed.
