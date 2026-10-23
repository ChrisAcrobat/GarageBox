# QA: tests for known faults are committed failing, so CI blocks the deploy until they are fixed

Importance: 3 – the Pages deploy stays blocked until the build bots fix F1–F3.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
The new checks for the faults found by QA fail now and are committed as they are, without a skip or "expected failure" marker:
- F1: the highway never ends notes (4 checks in `highway.test.html`);
- F2: the panel reset with tilt on from offset 0 (1 check in `guitar.test.html`);
- F3: the pluck hold (1 check in `pluck.test.html`).

The `test` job of `.github/workflows/pages.yml` therefore fails, and `deploy` does not run until they are fixed. The workflow itself is unchanged and works. Nothing has been pushed.

## Why
Design 9.2 says checks for designed behaviour that is not built yet fail until it is built. The task asked for tests that fail now and pass after the fix. A skip list would need its own mechanism and could be forgotten.

## Alternatives
- An "expected failure" list in `run-headless.mjs`.
- Keep the failing tests on a branch until the fixes are made.

## Where
`tests/highway.test.html`, `tests/guitar.test.html`, `tests/pluck.test.html`, `.github/workflows/pages.yml` (unchanged).
