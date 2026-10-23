# Keyboard drum hits recorded through the normal event stream

**Decision:** Letter-key (Drums mode) and numpad drum hits are ordinary noteOn events from the Keys instrument with `part: 'drums'`, `oneShot: true` and a `column`; no separate recording path was added. The app has no recorder yet (F13), so R4c.15's "recorded as part of the keyboard track" is met only in the sense that the hits belong to the keyboard lane's own event stream and will be captured with it once recording exists.

**Why:** A recorder that captures a lane's events then gets the drum hits on the keyboard track for free, with `part` telling it which sound plays them back.

**Alternatives:** Send the hits to a separate drum lane; build a minimal recorder now (out of scope for this build).

**Where:** `src/js/instruments/keys.js` (`_drumHit`).

Milestone: Build 3 – keyboard drums

Importance: 4 – a part of R4c.15 cannot be verified until recording is built.
