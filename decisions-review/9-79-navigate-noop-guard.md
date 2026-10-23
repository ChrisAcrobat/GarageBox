# 79. navigate() no-op on plain panels

**Decision:** **`navigate()` on a plain panel/view is a no-op (defensive), and `main.js` only routes intents to gamepad menus.**

**Why:** Two guards so a future caller cannot accidentally navigate a mouse panel.

**Alternatives:** Single guard in main.

**Where:** `settings-panel.js`, `debug-view.js`.

Milestone: Gamepad menu navigation

Importance: 9 – Internal defensive code.
