# Star power checkbox sits in the fields, not in panel-options

Importance: 5 – visible layout of the guitar panel and its gamepad order.

## Decision
The `starPower` checkbox (R5.5, default on) is a checkbox field in the fields grid of the per-device panel, outside `div.panel-options`. The tilt glide checkbox stays the only checkbox row in `panel-options` and the last control of the panel. `menu-nav.test.html` checks that `starPower` exists on the Xplorer (checked, not inside `panel-options`) and not on a gamepad.

## Why
Design 9.2 says the tilt glide checkbox is the last control and that up from it reaches *Reset to defaults*. A second checkbox row in `panel-options` (7.2 says checkbox rows go there) would break one of the two, so both cannot hold for a guitar that has star power and tilt glide. The 9.2 text is the more specific one.

## Alternatives
Star power as a second `panel-options` row before tilt glide (up from tilt glide would reach star power, not Reset); after it (tilt glide no longer last).

## Where
Design 6 (Star power), 7.2 (checkbox rows), 9.2; `tests/menu-nav.test.html`.
