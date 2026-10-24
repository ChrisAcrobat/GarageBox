# 62. Cursor identity via data-key

**Decision:** **The cursor is identified by `data-key` (fields) or the element's classes (buttons), so it survives `refresh()` re-rendering the fields; if the field disappears (e.g. instrument changed), it stays at the same position, clamped.**

**Why:** The panel rebuilds its fields on every setting change.

**Alternatives:** Store element references.

**Where:** `menu-nav.js identity()`, `SettingsPanel.refresh`.

Milestone: Gamepad menu navigation

Importance: 8 – Internal robustness detail.
