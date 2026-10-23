# Simple view in Drums mode shows only the keyboard

**Decision:** In the simple view, a keyboard lane in Drums mode draws only the on-screen keyboard with the drum names; the guitar fret row and the ringing-note list are not drawn. Pressed keys light up as feedback.

**Why:** Frets 1–5 and ringing notes have no meaning in Drums mode (R4c.13 turns keys 1–5 off and drum hits are one-shots).

**Alternatives:** Keep the fret row dimmed; show a list of recent drum hits.

**Where:** `src/js/visual/simple-view.js`.

Milestone: Build 3 – keyboard drums

Importance: 7 – cosmetic, simple view only.
