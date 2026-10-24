# A reset counter tells the guitar that its settings were reset

**Decision:** `store.js` counts each device's resets in memory (not saved) and `getDeviceSettings()` returns the count under the `RESET_COUNT` symbol; `guitarOptions()` passes it on as `resetCount`. `Guitar.configure()` treats a new `resetCount` as a reset: with tilt on it re-measures `tiltRef` from the current smoothed value and sets `tiltDelta = 0` even when the new `rangeOffset` equals `stepBase` (the usual 0 → 0 case, QA F2). Every other settings change still keeps `tiltDelta` and `tiltRef`, as design 4.2 `configure()` says.

**Why:** `configure()` only gets option values, and after a reset with a saved offset of 0 they are identical to other settings changes while tilt is on. A symbol key is ignored by `Object.entries` and JSON, so nothing else sees it, and it reaches the guitar through the normal `configure(guitarOptions(getDeviceSettings(id)))` path that the panel, Back-hold and the tests already use.

**Alternatives:** Re-measure on every `configure()` while tilt is on (would drop the tilt on any settings change, against design 4.2); a separate `guitar.resetRange()` call from `main.js` (the test and the panel's reset path go through `configure()` only); compare with `resetDeviceSettings` notifications (`key: null`) in the guitar (would couple the instrument to the store's listeners).

**Where:** `src/js/settings/store.js` (`RESET_COUNT`, `getDeviceSettings`, `resetDeviceSettings`), `src/js/instruments/setup.js` (`guitarOptions`), `src/js/instruments/guitar.js` (`configure`).

Milestone: Build 1 – guitar, tilt and whammy (QA F2)

Importance: 8 – an internal mechanism; the behaviour is the one design 4.2 and R4.5.6 describe.
