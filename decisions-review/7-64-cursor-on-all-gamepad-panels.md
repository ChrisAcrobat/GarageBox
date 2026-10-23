# 64. Cursor shown on every gamepad lane panel

**Decision:** **The cursor is shown on every gamepad lane's panel, also when it was opened with the mouse; the keyboard lane's panel has no cursor and no hint.**

**Why:** The controller can take over at any time; the keyboard device has no D-pad.

**Alternatives:** Show it only after the first D-pad press.

**Where:** `SettingsPanel`.

Milestone: Gamepad menu navigation

Importance: 7 – Largely superseded by decision 75.
