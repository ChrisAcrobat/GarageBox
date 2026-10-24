# Lazy drum channel and mode-change note-offs

**Decision:** A keyboard lane's drum kit channel (`{ source: 'midi', model: 'oneShot', drums: true }`, no effect chain) is created on the first drum hit, not when the lane is created. When `keysMode` changes, `Keys.configure()` queues note-offs for every ringing note and they are emitted at the start of the next `handle()` call (configure's return value stays unused).

**Why:** Most keyboard players never hit a drum, so a lazy channel saves loading the MIDI drum kit. `main.js` ignores configure's return value, and returning the note-offs as well as queuing them would send them twice.

**Alternatives:** Create the drum channel up front; return the note-offs from `configure()` and have `main.js` send them.

**Where:** `src/js/instruments/setup.js` (`DRUM_KIT_SOUND`), `src/js/main.js` (`channelFor`), `src/js/instruments/keys.js` (`configure`, `pending`).

Milestone: Build 3 – keyboard drums

Importance: 8 – internal; at worst the first hit is a little late while the kit loads.
