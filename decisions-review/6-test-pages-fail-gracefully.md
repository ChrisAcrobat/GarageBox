# Test pages always finish with PASS or FAIL

Importance: 6 – the CI gate depends on it; a hanging page would block every deploy.

## Decision
`tests/test-runner.js` loads the modules under test with `s.load(path, names)` (dynamic `import()`); a missing module or export is a FAIL check under "modules" and the page goes on with `{}`. Checks accept a function as `actual` (a throw is a FAIL), `s.section(name, fn)` records "section aborted" when a block throws, uncaught errors and unhandled rejections are FAIL checks, `s.withCleanStorage(fn)` saves and restores `localStorage` around a block, and a watchdog (45 s default, 55 s on the sound pages) finishes the page with FAIL. All pages were converted (detect, guitar, drums, keys, menu-nav, pluck) or written this way (effects, star-power, bass).

## Why
The pages test many functions that are designed but not built yet. With static imports one missing export makes the whole module graph fail to link, the page never sets its title and the CI job can only time out, with no useful output.

## Alternatives
Keep static imports and rely on the CI timeout; one page per module; skip checks whose export is missing (would hide unbuilt work).

## Where
`tests/test-runner.js`, every `tests/*.test.html`, design 9.2 (intro), `tests/README.md`.
