# 52. Highway gems fade at the far end

**Decision:** **Highway gems disappear (fade over the last 15 %) when they reach the far end; the sustain trail stays while the note rings.**

**Why:** Gems of long-ringing notes piled up at the far end.

**Alternatives:** Keep the gem until the note stops.

**Where:** `highway-view.js drawNote`.

Milestone: After the first hardware test

Importance: 4 – Visible behaviour of long notes on the highway.
