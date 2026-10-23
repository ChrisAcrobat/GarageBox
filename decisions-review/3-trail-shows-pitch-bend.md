# Trail shows pitch bend as width

Importance: 3 – visible on every guitar trail; owner asked for an effect and suggested width and/or opacity.

**Decision:** R5.4.5 / design 5 highway: the sampled pitch bend sets the trail width. No bend = normal width; bending down makes it thinner (−2 semitones = 50 %), bending up wider (up to 150 %), linear in semitones, clamped. Opacity stays tied to volume only.

**Rationale:** opacity already shows volume (R5.4), so reusing it would mix two meanings. Width maps naturally to "lower/thinner, higher/wider" and keeps the history along the trail.

**Alternatives:** opacity change; a sideways wiggle that follows the bend; a colour shift; width plus opacity.

**Where:** highway view (`highway-view.js`), guitar and bass trails, and any instrument that bends.
