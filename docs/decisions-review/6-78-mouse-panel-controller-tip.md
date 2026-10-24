# 78. Tip on mouse-opened gamepad panels

**Decision:** **A mouse-opened panel on a gamepad lane shows a small tip ("open this menu with Start on the controller to use it with the controller") instead of the controller key hint; no cursor is drawn.**

**Why:** Keeps the feature discoverable without implying the controller drives this panel.

**Alternatives:** No hint at all.

**Where:** `settings.gamepadHintMouse` in `lang/en.json`/`lang/sv.json`, `SettingsPanel.refresh`.

Milestone: Gamepad menu navigation

Importance: 6 – Small visible hint.
