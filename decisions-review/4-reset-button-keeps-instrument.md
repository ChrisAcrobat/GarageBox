# Reset to defaults button = 5 s level (keeps the instrument)

Importance: 4 – which reset the panel button does.

**Decision:** R4.11.2, design 7.2: the panel's *Reset to defaults* button does the 5 s level (`keepInstrument: true`): all per-device settings back to defaults except the instrument choice; tilt on/off left as it was; no toast. A full reset including the instrument is only the 10 s Back hold; in the panel the instrument field is right there anyway.

**Rationale:** the owner made "keep the instrument" the normal reset; a button pressed from a menu should not suddenly switch a lane from guitar to drums and close/rebuild its panel.

**Alternatives:** the button does the full reset; two buttons (Reset / Full reset).

**Where:** R4.11.2, design 7.2, 8 (`resetDeviceSettings`), 9.2.
