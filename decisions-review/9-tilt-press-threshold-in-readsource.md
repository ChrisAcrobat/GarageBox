# Tilt press threshold in readSource

**Decision:** `readSource(source, raw, atLeast)` takes an optional press threshold; `readLogical` passes `TILT_PRESS_THRESHOLD` (0.9) for `tilt`, so tilt's `pressed` is true at a mapped value of 0.9 or more (with a 1e-9 tolerance), while other controls keep the default threshold.

**Why:** R5.7/R5.8 and star power (R5.5) need tilt "pressed" at 0.9; one parameter keeps the logic in one place.

**Alternatives:** A per-control `pressAt` field in each mapping.

**Where:** `src/js/input/mappings.js`.

Milestone: Build 1 – guitar, tilt and whammy

Importance: 9 – internal.
