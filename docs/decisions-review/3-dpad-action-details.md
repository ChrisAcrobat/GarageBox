# D-pad action: my sub-choices

Importance: 3 – the owner decided the feature and its options; these are the details I chose.

**Decision:** (R2.10, R4.15; design 3.1, 4.1, 4.2, 7.2, 8, 9.2)
- **Effect wraps** (Epic → Clean, Clean ← Epic), like the menu selects (5-61); with three options a full turn is two presses at most, and the toast says where you are.
- **Sound list:** guitar = plucked string, MIDI Automatic (Electric Guitar (clean), 27), then GM 24, 25, 26, 28, 29, 30, 31; bass = bass sound, plucked string, MIDI Automatic (Electric Bass (finger), 33), then GM 32, 34–39. Only the instrument's own GM family, because cycling all 128 programs with one button is unusable. A program chosen in the panel outside the list: right → first entry, left → last. The toast shows the GM name (−1 shows the default's name rather than "Automatic (…)", shorter). A generated source keeps the stored program.
- **Octave shift** takes the current `rangeSteps()` (including a tilt delta) as the start, moves by `scale.length`, clamps to ±stepLimit, saves `rangeOffset` at once even while tilt is on (unlike the Back toggle, which saves only when tilt goes off), and with tilt on re-measures the reference so the range is exactly the new base. At the limit it still shows the toast (no change). Toast "Octave ±k" when the offset is a whole number of octaves, otherwise "Range +7 steps" (a tilt lock between octaves). It moves `rangeOffset`, not the R4.13 octave setting, so the toast counts from the octave setting's range.
- **Key** wraps C..B; the existing near-E3 placement (decision 3-03) means A# → B drops eleven semitones and B → C goes up one. Accepted; documented.
- **Who handles what:** the guitar does the octave shift itself (it owns the range state) and emits `rangeShifted`; for effect/key/sound it emits `dpad { dir }` and `main.js` changes the stored setting, so everything goes through the normal settings path and an open panel refreshes.
- **Scope:** guitar and bass lanes only (Xplorer and gamepad guitar/bass mode). Drums: no, D-pad left/right are drum pads (5-70, 8-74, R4b.1). Keyboard: no D-pad; its guitar keys get nothing. Works in a mouse-opened panel (R2.14), not in a controller menu (directions filtered). One change per press, no auto-repeat.
- **Gamepad guitar mode free buttons:** D-pad left/right (standard buttons 14/15) are used; RB, LT, RT, both sticks and stick clicks stay unused.
- **UI strings:** `settings.dpadAction` en "D-pad left/right" / sv "Styrkors vänster/höger"; options en "Shift range one octave / Change effect / Change key / Change sound / Off", sv "Flytta läget en oktav / Byt effekt / Byt tonart / Byt ljud / Av"; toasts `lane.octave` "Octave {value}" / "Oktav {value}", `lane.range` "Range {steps}" / "Läge {steps}", `lane.key` "Key: {note}" / "Tonart: {note}"; effect names `effect.clean/crunch/epic` en Clean/Crunch/Epic, sv Ren/Crunch/Episk (these labels did not exist in the docs yet).

**Alternatives:** clamp the effect at the ends; cycle all 128 GM programs; let the octave option change the R4.13 octave setting instead of `rangeOffset`; also give drums a D-pad action (would steal two pads).

**Where:** see Decision.
