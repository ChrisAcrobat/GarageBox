# 47. Drum mapping stored as one drumMap object

**Decision:** **Drum mapping stored as one object `drumMap` (only changed entries matter, defaults fill the rest).**

**Why:** Store stays simple; new controls get defaults.

**Alternatives:** One setting per control.

**Where:** `store.js` validator, `drums.js`.

Milestone: Milestone 4 – highway, settings, whammy/tilt

Importance: 8 – Storage format, invisible to the user.
