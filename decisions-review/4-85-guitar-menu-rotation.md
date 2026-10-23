# 85. Guitar menu directions turned 90° clockwise (R2.12)

- **Decision:** On a guitar controller the menu directions are rotated clockwise: right = next, left = previous, strum up = value forwards, strum down = value backwards. Chosen by the owner after trying both directions on the real Xplorer (uncommitted experiment, reverted). Scope chosen by me: every menu of a controller detected as a guitar (settings panel and device information view), whatever instrument it plays; not a regular gamepad in guitar/bass mode; start screen not rotated.
- **Rationale:** Matches how the guitar is held. Detected type instead of exact Xplorer id, since the id may not show in the gamepad name on every OS.
- **Alternatives:** Rotate only the settings panel (as in the experiment); also rotate a gamepad in guitar mode.
- **Where:** R2.12, design 7.4, `menu-nav.js`, `settings-panel.js` hint, `menu-nav.test.html`.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

Importance: 4 – Changes how every guitar menu is driven; owner chose it on the real guitar.
