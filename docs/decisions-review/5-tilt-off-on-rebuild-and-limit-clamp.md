# Tilt off after an instrument rebuild; out-of-range offset clamped, not rewritten

Importance: 5 – edge cases.

**Decision:** design 4.2: tilt state lives in the `Guitar` instance, so rebuilding it (e.g. after an instrument change) starts with tilt off, like a reload. A stored `rangeOffset` larger than the current scale's limit (e.g. 18 after switching from blues to pentatonic) stays stored but `rangeSteps()` clamps it to the limit; it is only rewritten when tilt is next locked.

**Rationale:** matches experiment E; switching back restores the old offset.

**Alternatives:** clamp and save immediately on scale change; keep tilt on across rebuilds.

**Where:** R4.5.5, R4.5.6, design 4.2.
