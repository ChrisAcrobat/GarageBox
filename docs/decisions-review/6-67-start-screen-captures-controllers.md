# 67. Start screen captures all controllers

**Decision:** **While the start screen is up, every controller's directions, Back and Start go to it only (not to the instruments or the settings toggle).**

**Why:** The start screen is global, not tied to a lane; Start must not also open a settings panel behind it.

**Alternatives:** Only controller 1 drives it.

**Where:** `main.js menuInput()`.

Milestone: Gamepad menu navigation

Importance: 6 – Edge-case behaviour on the start screen.
