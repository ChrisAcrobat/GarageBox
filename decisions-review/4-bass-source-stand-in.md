# Bass sound choice accepted before the bass source exists

**Decision:** The store already accepts `source: 'bass'` and `soundCycle('bass')` lists the bass sound first (bass sound, plucked string, MIDI ...), as decided in 3-dpad-action-details. Until `bass-source.js` exists, `setup.js` plays a stored or cycled `bass` with the plucked string (`STAND_IN_SOURCES`). The bass lane's default source stays `pluck` for now; the build that adds the bass sound (R3.4.1) makes `bass` the default and removes the stand-in.

**Why:** Build 1 owns the D-pad "sound" action (R4.15) and its cycle, but not the bass sound itself (bot 2). Without the stand-in, choosing the first entry of the cycle would give silence or an invalid setting.

**Alternatives:** Leave `bass` out of the cycle until bot 2 adds it (the cycle and its test would then change twice); map it to MIDI instead of pluck.

**Where:** `src/js/instruments/setup.js` (`SOURCES_FOR`, `STAND_IN_SOURCES`, `resolveSource`, `soundCycle`), `src/js/settings/store.js`.

Milestone: Build 1 – guitar, tilt and whammy

Importance: 4 – for a short time a bass lane set to "Bass sound" sounds like the plucked string.
