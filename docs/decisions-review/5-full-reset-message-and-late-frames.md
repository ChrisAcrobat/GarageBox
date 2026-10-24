# Full reset message wording and late-frame catch-up

Importance: 5 – small wording/timing details of the 10 s reset.

**Decision:**
- Message at 10 s: `lane.fullReset` en "Full reset, instrument too", sv "Allt återställt, även instrumentet" (the owner suggested "Full reset" / "Allt återställt"; I added the instrument so the player knows why the lane may change). It replaces the 5 s toast if that is still visible. The panel button shows no toast.
- `BackHold.release` returns nothing after a reported tier, but catches up a tier that was reached and not yet reported because no frame ran in between (release at 7 s with no update → `'hold'`). One `update` jumping past 10 s with nothing reported returns only `'fullReset'`.
- The lane's instrument object is kept on the 5 s reset (type unchanged → `configure`), so the guitar's own hold timer reaches 10 s; if the full reset changes the type, the new instrument has no pending press.

**Rationale:** clear message; no reset lost to a slow frame; matches how `setupInstrument` already reconfigures instead of rebuilding.

**Alternatives:** plain "Full reset"; ignore late frames; move the hold timer to `main.js` for all lanes.

**Where:** R4.11.3, design 4.2 (BackHold, resetToDefaults), 9.2.
