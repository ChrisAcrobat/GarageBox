# Aligning the tests with experiment whammy-E

Importance: 3 – which of two sources of truth the tests follow.

## Decision
The pages follow the design text where `/workspace/ms-experiments/whammy-E/tests` differs:
- Checkboxes in menus are toggled by Start; left/right do nothing on a checkbox and on a button (whammy-E: left/right toggle, right presses a button). See also `5-checkbox-toggled-by-start.md`.
- The tilt glide checkbox label is checked as `label.field.field-checkbox` whose text is `settings.tiltGlide` (whammy-E read `parentElement.textContent`).
Everything else from whammy-E's tests (tilt glide, note strip, tilt range) was kept with the design's names.

## Why
The task says the design wins on conflicts.

## Alternatives
Follow the experiment's code (it is what the developers will merge from).

## Where
`tests/menu-nav.test.html`, `tests/guitar.test.html`.
