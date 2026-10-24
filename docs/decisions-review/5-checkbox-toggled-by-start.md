# Tilt glide checkbox is toggled by Start, not left/right

Importance: 5 – small controller-menu detail.

**Decision:** design 7.4 / menu-nav tests: the checkbox follows R2.12 (Start toggles a checkbox, left/right do nothing on it). Experiment E's code toggled it with left/right (the repo's `menu-nav.js` does that for checkboxes), which contradicts the docs.

**Rationale:** the docs are the spec, and one rule for all checkboxes (also star power's).

**Alternatives:** left/right toggle (as in the experiment code); both.

**Where:** R2.12, design 7.4, 9.2 (`menu-nav.test.html`).
