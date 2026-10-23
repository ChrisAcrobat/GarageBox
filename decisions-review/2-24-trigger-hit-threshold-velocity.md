# 24. Trigger hit threshold and velocity

**Decision:** **Trigger hit threshold 0.2, re-arm below 0.1, velocity 30-127 from the value at the crossing; digital velocity 100**.

**Why:** A fast squeeze reads high in the crossing frame, a slow one low.

**Alternatives:** Peak detection over several frames (adds latency).

**Where:** `drums.js`.

Milestone: Milestone 3 – more instruments

Importance: 2 – Decides how trigger drums feel and how loud hits are.
