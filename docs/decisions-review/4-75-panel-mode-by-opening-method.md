# 75. Panel mode decided by how it was opened

**Decision:** **The way a settings panel is opened decides its mode: Start on the controller → gamepad menu (navigation, cursor, tap-to-play); ⚙ button (mouse click or keyboard) → plain panel where the instrument gets every edge as without a panel (strum, Back toggles tilt / 5 s hold resets, all drum pads).**

**Why:** Owner's request: a mouse user adjusts settings while playing; no strong reason found to keep navigation active, since the D-pad/strum would otherwise be lost for playing.

**Alternatives:** Mode by last input device; navigation always on.

**Where:** `main.js toggleSettings/menuInput/playInstruments`, `SettingsPanel gamepadMenu` (supersedes the "cursor also on mouse-opened panels" part of entry 64).

Milestone: Gamepad menu navigation

Importance: 4 – Owner's request, already in R2.14; worth a quick sanity check.
