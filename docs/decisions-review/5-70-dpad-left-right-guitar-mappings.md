# 70. D-pad left/right added to guitar mappings

**Decision:** **D-pad left/right added to both guitar mappings (`guitar-standard` B14/B15, confirmed on the Xplorer by the owner; `guitar-xpad` hat axis 6, unconfirmed). A guitar set to drums therefore gets two more pads on them (hand clap, cowbell, from `DEFAULT_DRUM_MAP`) and the simple view shows Left/Right pills.**

**Why:** Needed for value changes in menus; the drum pads come for free from the existing default map.

**Alternatives:** Exclude them from drums/pills.

**Where:** `mappings.js`, `drums.js` (unchanged), design 4.3.

Milestone: Gamepad menu navigation

Importance: 5 – Visible extras, mostly for menus; xpad hat axis unconfirmed.

**Update 2026-10-22 (owner's D-pad action, R4.15):** during play on guitar/bass, D-pad left/right now do the selectable D-pad action; the gamepad guitar/bass mode gets `dpadLeft`/`dpadRight` too. Drums keep them as pads; menus keep left/right for values.
