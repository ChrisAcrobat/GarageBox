# Star power ends at once when it is turned off or the instrument changes

**Decision:** If the star power checkbox is unchecked while star power is on, the guitar ends it in the next frame (`starPower` event with `on: false`) instead of letting the 8 s countdown run. When the lane's instrument is replaced (another instrument, disconnect), the lane's star power visual is switched off too. A reset that keeps the instrument does not end it; the normal countdown does.

**Why:** Otherwise the glow could stay on forever, because the trigger no longer runs once the option is off.

**Alternatives:** Let it fade out with the countdown; ignore the checkbox until star power ends.

**Where:** `src/js/instruments/guitar.js` (`_starPower`), `src/js/main.js` (`releaseInstrument`).

Milestone: Build 1 – guitar, tilt and whammy

Importance: 6 – a rare edge case.
