# Orientation reference follows bass octave and octave setting

Importance: 4 – where the bars appear for bass and Low/High octave.

**Decision:** design 4.2, 6: `rootMidi` is the actual fret-1 note at offset 0 after key, bass octave and the `octave` setting, so the reference note (yellow fret at offset 0) moves with them (bass default A2, Low A2, High A4 for E minor pentatonic). The bar count is relative to that reference.

**Rationale:** the bars mark the player's own "home" fret position, whatever octave it is in.

**Alternatives:** a fixed reference (A3) for all octaves.

**Where:** R5.8, design 4.2 (scale basis), 6 (Note strip).
