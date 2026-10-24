# Piano/Drums select and drum fields in the settings panel

**Decision:** The keyboard's settings panel starts with a select labelled "Instrument" (Piano / Drums), stored as the device setting `keysMode`. In Drums mode the note-only fields (source, program, effect, root, scale, fade, ring time, tone) are hidden and a "Drum sounds" group lists one select per letter key (labelled with the letter, options = the drum controller's sounds plus None). A "Numpad drums" group with one select per numpad key is shown in both modes. Maps are stored as `{ code: midiNote }` objects, missing or invalid entries fall back to the default map, and 0 means none. The ring time/tone rule for keys lanes stays as it was in Piano mode (guitar keys are plucked) and is switched off in Drums mode.

**Why:** Reuses the existing panel field and drum-sound option machinery; R4c.12 asks for the setting in the advanced settings and R4c.14 for per-key reassignment including none.

**Alternatives:** A separate keyboard-drums panel; checkboxes instead of a select; storing the full map rather than per-key overrides.

**Where:** `src/js/ui/settings-panel.js`, `src/js/settings/store.js`, `src/lang/*.json`.

Milestone: Build 3 – keyboard drums

Importance: 6 – the user sees and uses these controls.
