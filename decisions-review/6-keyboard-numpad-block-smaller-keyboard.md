# Numpad block on the on-screen keyboard

**Decision:** The on-screen keyboard always draws a numpad block (rows 7-8-9 / 4-5-6 / 1-2-3 and a wide 0) to the right of the letter rows, with each pad's short drum name; a pad lights while pressed. The drawing grows from 11.2 to about 12.6 key units wide, so the whole keyboard is drawn slightly smaller than before, in both modes.

**Why:** R4c.15 says the numpad kit works in both modes, so the player needs to see what each pad plays without opening the settings. A fixed width keeps the layout the same when switching modes.

**Alternatives:** Show the numpad block only in Drums mode, or only once a numpad key has been pressed; draw it as a separate overlay.

**Where:** `src/js/visual/keyboard-view.js` (`NUMPAD_X`, `NUMPAD_KEY`, `UNITS`).

Milestone: Build 3 – keyboard drums

Importance: 6 – visible on every keyboard lane, and the keys are a little smaller.
