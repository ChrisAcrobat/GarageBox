# 41. Highway rendering parameters

**Decision:** **Highway: 3 s travel time, perspective far end 1/3.2 wide, level history sampled at 40 Hz, trail drawn in slices with historic opacity, moving cross lines every 0.5 s.**

**Why:** Readable at 60 fps; trails fade along their length (R5.4).

**Alternatives:** Opacity from the current level only (simpler, but the whole trail would blink).

**Where:** `highway-view.js`.

Milestone: Milestone 4 – highway, settings, whammy/tilt

Importance: 3 – Defines the look of the default view (travel time later changed by 53).
