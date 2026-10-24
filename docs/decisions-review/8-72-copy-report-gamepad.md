# 72. Copy report via gamepad

**Decision:** **Copy report pressed with the gamepad uses the same copy code; if the browser refuses the clipboard without a user gesture, the existing manual-copy fallback appears.**

**Why:** No extra code path.

**Alternatives:** Hide the button for the gamepad.

**Where:** `debug-view.js`.

Milestone: Gamepad menu navigation

Importance: 8 – Rare edge case in the debug view.
