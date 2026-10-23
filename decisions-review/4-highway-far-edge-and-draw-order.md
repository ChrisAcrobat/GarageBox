# Highway: far end and draw order details

Importance: 4 – visual details.

(The bend-width part of this decision was removed on 2026-10-24: the owner chose the trail width at full whammy, 20 %, after the hardware test, R5.4.5.)

## Decision
- R5.4.4: the road outline is stroked along the near end and both sides only (no line across the far end), and the road now starts at the very top of the lane's content area (was 4 px below the header). The lane header strip stays; there is no CSS border on the highway area (the `border-top` rules in style.css belong to the settings panel and debug view, not to the lane).
- R5.4.1: notes are drawn oldest first (by start time).
- R5.4.3: unchanged; the detached near end already moved at the road's constant speed from the near end.

## Why
Smallest change that meets the requirements.

## Alternatives
Fade the road's top instead of removing the edge.

## Where
`src/js/visual/highway-view.js` (`drawRoad`, `HighwayState`); design 6, R5.4.1, R5.4.3, R5.4.4.
