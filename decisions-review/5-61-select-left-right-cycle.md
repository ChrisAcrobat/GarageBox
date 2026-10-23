# 61. Selects cycle with left/right

**Decision:** *(Partly superseded 2026-10-22: Start presses buttons and toggles checkboxes, right no longer does.)* **Selects cycle and wrap with left/right and fire `change` (and `input`), so the existing store-write handler runs; number/range step, checkboxes toggle with either direction; on a button only right presses it.**

**Why:** Reuses the mouse code path; left on a button doing nothing avoids accidental presses.

**Alternatives:** Left also presses; clamp selects at the ends.

**Where:** `MenuNavigator.adjust`.

Milestone: Gamepad menu navigation

Importance: 5 – Menu value-changing behaviour, partly already revised.
