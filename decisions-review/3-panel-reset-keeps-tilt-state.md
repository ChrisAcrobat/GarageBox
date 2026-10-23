# Panel reset keeps tilt on/off; the 5 s hold turns it off

Importance: 3 – two resets behave slightly differently.

**Decision:** R4.11.2 / design 4.2, 7.2: *Reset to defaults* clears the stored settings (range offset 0) but leaves tilt range shifting on or off; if on, the guitar re-measures the reference so the range is exactly 0. The 5 s Back hold additionally turns tilt off and fades ringing notes. Taken from experiment E's code.

**Rationale:** the button is pressed in a menu (no hand on the tilt), while the hold is a "get me back to normal" gesture during play.

**Alternatives:** the button also turns tilt off; the hold leaves tilt as it was.

**Where:** R4.5.6, R4.11.2, design 4.2 (`configure`, `resetToDefaults`), 7.2.

**Update 2026-10-22 (owner's reset tiers):** the button is now the 5 s level: it keeps the instrument choice (`resetDeviceSettings(id, { keepInstrument: true })`) and shows no toast; only the 10 s Back hold resets the instrument too (R4.11.3).
