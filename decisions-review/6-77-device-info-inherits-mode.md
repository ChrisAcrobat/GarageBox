# 77. Device information view inherits panel mode

**Decision:** **The device information view inherits the mode of the panel it was opened from** (gamepad menu → navigable with Back closing; plain panel → no cursor, no hint, Back toggles tilt / 5 s hold resets, as during play).

**Why:** Predictable; the view can only be opened from the panel.

**Alternatives:** Decide by which input pressed the button.

**Where:** `main.js openDebug`, `DebugView gamepadMenu`.

Milestone: Gamepad menu navigation

Importance: 6 – Predictable follow-on of 75, rarely noticed.
