# UI texts chosen in build 1

**Decision:** Texts not given in the docs:
- `octave.-1/0/1` en "Low (one octave down)" / "Middle" / "High (one octave up)", sv "Låg (en oktav ned)" / "Mellan" / "Hög (en oktav upp)" (R4.13 names); `settings.octave` "Octave" / "Oktav".
- `settings.starPower` en "Star power (neck up + whammy all the way)", sv "Stjärnkraft (halsen upp + whammy i botten)".
- `topbar.noteNames` "Note names" / "Tonnamn"; option labels are the natural notes of each list ("C D E F G A B", "C D E F G A H").
- Units in number-field labels, as "(unit)": `unit.msName` "ms", `unit.secondsName` "s", `unit.semitonesName` "semitones" / "halvtoner".
- `settings.bendRangeHint`, the D-pad action hint, and `settings.gamepadHintFrets` (a gamepad playing guitar/bass: frets play while the menu is open) next to `settings.gamepadHintGuitar` (rotated directions on a guitar controller) and `debug.gamepadHintGuitar`.

**Why:** The build needed these strings; the docs name the features but not all texts.

**Alternatives:** Other wordings.

**Where:** `src/lang/en.json`, `src/lang/sv.json`.

Milestone: Build 1 – guitar, tilt and whammy

Importance: 7 – wording only.
