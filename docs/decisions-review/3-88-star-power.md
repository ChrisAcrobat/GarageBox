# 88. Star power trigger and effect (R5.5)

- **Decision:** Owner asked for star power: neck up + whammy fully pressed → confetti and changed light, sound unaffected; full design later (F11). Owner then specified: star power lasts while the neck is held up; lowering starts a hidden countdown, raising again before it ends cancels it and the countdown restarts from full. My details: start at smoothed tilt ≥ 0.9 and whammy ≥ 0.95 in the same frame; neck counts as up at ≥ 0.8 while active; countdown 8 s; restart after end needs the start trigger; confetti only over the lane, ~150 pieces in fret colors (30 with reduced motion); blue-white glow; per-device checkbox, default on; works regardless of the whammy assignment and whether tilt range shifting is on (updated for experiment E: the tilt has no sound assignment any more).
- **Rationale:** Thresholds near the end of travel so it does not trigger by accident; lane-only so other players are not disturbed.
- **Alternatives:** Whole-screen confetti; trigger on raw tilt; no setting.
- **Where:** R5.5, F11, design 6 (Star power), `star-power.js`, `star-power.test.html`.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

Importance: 3 – Very visible effect on guitar lanes; owner specified the behaviour, thresholds and visuals are mine.

**Update 2026-10-22:** owner asked star power to use the tilt button: it now starts when `tilt` is pressed (mapped ≥ 0.9, raw ≤ −0.8) and whammy ≥ 0.95, stays on while `tilt` is pressed, and the 8 s countdown starts when `tilt` is released (design 6). This replaces the smoothed-tilt thresholds 0.9/0.8 above.
