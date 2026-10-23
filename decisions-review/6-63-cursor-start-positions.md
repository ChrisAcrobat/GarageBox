# 63. Cursor start positions

**Decision:** **The settings panel cursor starts on the first field (Instrument), the device information cursor on its close button; the panel header's × button is reachable with up from the first field.**

**Why:** Same start points as the existing native focus.

**Alternatives:** Start on ×.

**Where:** `SettingsPanel`, `DebugView` constructors.

Milestone: Gamepad menu navigation

Importance: 6 – Small visible navigation detail.
