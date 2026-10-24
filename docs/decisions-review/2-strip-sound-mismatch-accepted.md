# Note strip may run up to ~0.7 step ahead of the sound (glide off)

Importance: 2 – visible near every step boundary while tilt is on without glide.

**Decision:** R5.7.1: keep the continuous strip (no hysteresis) while the sound uses whole steps with the 0.2-step hysteresis. Near a boundary the strip can differ from the sound by up to 0.5 + 0.2 = 0.7 step. Documented as accepted; with tilt glide on, both share one value; tilt off snaps the strip to the locked step.

**Rationale:** the owner approved the smooth sliding strip; the strip showing where the range is heading is useful, and the hysteresis is needed against flicker in the sound.

**Alternatives:** strip uses the hysteresis step too (jumps, no slide); strip follows the sound but animates between steps; apply hysteresis to the display (would lag).

**Where:** R5.7, R5.7.1, design 6 (Note strip).
