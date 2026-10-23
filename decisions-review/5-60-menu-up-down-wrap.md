# 60. Menu up/down wrap, no 2-D navigation

**Decision:** **Up/down follow document order and wrap at both ends; the multi-column field grid is read row by row (no 2-D navigation).**

**Why:** Simple and predictable; left/right are taken by value changes.

**Alternatives:** Clamp at the ends; 2-D grid navigation.

**Where:** `MenuNavigator.move`.

Milestone: Gamepad menu navigation

Importance: 5 – Navigation feel in menus.
