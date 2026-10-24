# 68. Tap-to-play rules

**Decision:** **Tap-to-play: only while the settings panel is open (not the device information view); a fret press mutes that fret's ringing note and plays at once, release stops only notes that were tapped (with the mute fade); leaving tap mode lets tapped notes still held ring on like strummed ones.**

**Why:** Matches the agreed feature; the debug view is for raw input checks; strummed notes from before the menu are not cut by a release.

**Alternatives:** Stop tapped notes when the menu closes; tap also in the device information view.

**Where:** `guitar.js setTapToPlay`, `main.js playInstruments`.

Milestone: Gamepad menu navigation

Importance: 2 – Directly heard while trying sounds in the menu.
