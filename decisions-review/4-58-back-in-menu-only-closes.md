# 58. Back in a menu only closes it

**Decision:** **Back in a menu only closes it; it does not toggle tilt or start the 5 s reset (R4.11.1). A Back press already pending when the menu opened is forgotten, and the release of the press that closed a menu does nothing.** (Updated for experiment E: Back no longer mutes at all.)

**Why:** Closing a menu should not change the range or reset settings; tapped notes stop on fret release anyway.

**Alternatives:** Close and mute.

**Where:** `main.js menuInput()`.

Milestone: Gamepad menu navigation

Importance: 4 – Noticeable when closing a menu while notes ring.
