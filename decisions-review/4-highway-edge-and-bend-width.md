# Highway: far end and bend width details

Importance: 4 – visual details.

## Decision
- R5.4.4: the road outline is stroked along the near end and both sides only (no line across the far end), and the road now starts at the very top of the lane's content area (was 4 px below the header). The lane header strip stays; there is no CSS border on the highway area (the `border-top` rules in style.css belong to the settings panel and debug view, not to the lane).
- R5.4.5: each trail sample stores the channel's current bend (`VoiceTracker.bend`, set by the Channel on every `bend` event), and the trail width is `1 + 0.25 × semitones`, clamped to 0.5–1.5. The bend is per channel, so all voices of an instrument show it, also a note started while bending.
- R5.4.1: notes are drawn oldest first (by start time).
- R5.4.3: unchanged; the detached near end already moved at the road's constant speed from the near end.

## Why
Smallest change that meets the requirements; the bend lives on the channel because the whammy bends the whole instrument (3-39).

## Alternatives
Fade the road's top instead of removing the edge; store bend per voice in the guitar events.

## Where
`src/js/visual/highway-view.js` (`drawRoad`, `bendWidth`, `HighwayState`), `src/js/audio/audio-engine.js` (`VoiceTracker.bend`); design 6, R5.4.1–R5.4.5.
