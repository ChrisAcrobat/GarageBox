# 69. Tap-to-play as a mode flag on Guitar

**Decision:** **Tap-to-play is a mode flag on the `Guitar` instrument set by `main.js` every frame (`setTapToPlay(!!ui.panel)`), not a separate instrument.**

**Why:** Keeps fret/mute bookkeeping in one place and testable.

**Alternatives:** A wrapper instrument.

**Where:** `guitar.js`.

Milestone: Gamepad menu navigation

Importance: 8 – Internal structure.
