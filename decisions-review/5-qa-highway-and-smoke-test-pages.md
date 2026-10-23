# QA: two new test pages, highway.test.html and app-smoke.test.html

Importance: 5 – adds tests; no app change.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
- `tests/highway.test.html` runs the highway view the way `main.js` does when the view is Highway: frame by frame through `drawHighway` only, without the simple view. It checks:
  - that a released note that has faded out gets an end time and is removed, and that the tracker drops the silent voice;
  - that a pluck note left to ring ends at about 5.7 s;
  - the draw order of R5.4.1, recorded from the `fill()` calls of a real canvas;
  - `bendWidth` (R5.4.5);
  - that `drawFretRow`/`drawLabelStrip`, `drawHighway` and `drawSimpleView` draw without errors for guitar, drums and keyboard lanes.

  The bug 1 checks go through `drawHighway`, not through `HighwayState.update` alone, so the developers can fix the fault in either place.
- `tests/app-smoke.test.html` loads `src/index.html` through `srcdoc` with a `<base>` and an error hook in front of the app's scripts. It starts the app with the keyboard, plays, and switches view, language and keyboard mode. It fails on uncaught errors, unhandled rejections and `console.error`. It is based on a QA scratch script.
- I checked that both pages catch the `drawLabelStrip` ReferenceError of f5b2244 (fixed in 60b67b3) and that they pass at HEAD. `highway.test.html` passes once the trackers are pruned in `drawHighway` (tried in a scratch copy, not committed).

## Why
Bug 1 hid because the existing highway test in `guitar.test.html` calls `tracker.active()` itself, and the simple view does the same in the app. The ReferenceError only showed when drawing, which no test did. CI picks up new `*.test.html` pages automatically, so no workflow change is needed.

## Alternatives
- Add the checks to `guitar.test.html`. It is already long, and these checks are about views, not the guitar.
- Use a Playwright-only smoke script outside the pages. CI runs only test pages, so it would need a workflow change.

## Where
`tests/highway.test.html`, `tests/app-smoke.test.html`, `tests/index.html`, `tests/README.md`, design 9.2.
