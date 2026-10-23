# 56. Menu intents from logical control names

**Decision:** **Menu intents come from logical control names: up = `dpadUp`/`strumUp`, down = `dpadDown`/`strumDown`, left/right = `dpadLeft`/`dpadRight`, plus `back`, `start`.**

**Why:** Works for every mapping and instrument mode without raw indexes; on the Xplorer strum and D-pad up/down are the same buttons anyway.

**Alternatives:** A separate per-mapping nav table.

**Where:** `menu-nav.js NAV_SOURCES`.

Milestone: Gamepad menu navigation

Importance: 7 – Internal mapping technique.
