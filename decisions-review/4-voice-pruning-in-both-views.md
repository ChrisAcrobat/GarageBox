# Silent voices pruned per lane in both views (VoiceTracker.prune)

Importance: 4 – implementation detail; fixes QA F1.

## Decision
`VoiceTracker` gets `prune(now)`, which drops voices below the 2 % level (without the channel volume, as before). `active(now)` calls it. A new helper, `pruneLaneVoices(lane, now)` in `simple-view.js`, prunes every channel of a lane: main, the keyboard's guitar keys and the keyboard's drum channel. Both `drawSimpleView` and `drawHighway` call it first, every frame. As a result:
- highway notes get their end time, so the trail detaches and the note is removed once it has left the road;
- the keyboard's ringing labels go away;
- drum voices are dropped in both views.

## Why
Before this, only `active()` pruned, and only the simple view's guitar and keys sections called it. The highway view alone never ended notes. Drum voices were never dropped, and the tracker map grew for the whole session. Pruning in the draw call keeps the tracker passive (no timers) and fits design 5: "dropped for every channel and in both views".

## Alternatives
- Prune inside `HighwayState.update`: it only reaches trackers that have notes on the road.
- Prune in `main.js draw()`: tests and other callers of `drawHighway` would not get it.
- Prune on every audio event: no pruning while nothing is played.

## Where
- `src/js/audio/audio-engine.js` (`VoiceTracker.prune`, `active`)
- `src/js/visual/simple-view.js` (`pruneLaneVoices`, `drawSimpleView`)
- `src/js/visual/highway-view.js` (`drawHighway`)
