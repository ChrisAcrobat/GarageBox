# 57. Menu controls withheld from the instrument

**Decision:** **While a lane's menu is open, its D-pad/strum directions and Back are removed from the edges the instrument sees; Start is still passed through.**

**Why:** Strum must not strum, D-pad drum pads must not play, Back should only close (not also toggle tilt or count toward the 5 s reset, R4.11.1; a pending Back press is cancelled every frame a menu owns Back); Start already toggles the panel through the instrument's `openSettings` action, so that path stays unchanged.

**Alternatives:** Let the instrument see everything and only add navigation.

**Where:** `main.js menuInput()`, `MENU_CONTROLS`.

Milestone: Gamepad menu navigation

Importance: 3 – Decides what plays and what navigates while a menu is open.
