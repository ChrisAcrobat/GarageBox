# 65. Browser focus handling for panels

**Decision:** **A panel opened with the gamepad Start does not move the browser focus into it, and closing a panel only returns the focus to the lane's ⚙ button if the focus was inside the panel; the device information view does the same depending on where the focus was.**

**Why:** Avoids a second (blue) focus ring beside the gamepad cursor and keeps the computer keyboard playing; mouse/keyboard opening behaves exactly as before.

**Alternatives:** Always focus (old behavior).

**Where:** `main.js toggleSettings/closeSettings/openDebug`, `focus` option of `SettingsPanel`/`DebugView`.

Milestone: Gamepad menu navigation

Importance: 7 – Avoids double focus rings; subtle.
