# Tests (developer documentation)

The test pages check the app's logic and sounds in a real browser (design 9.2). They are plain ES modules with no dependencies, like the app; they are not published with the app (only `src/` is, R7.3).

| Page | Covers |
|---|---|
| `detect.test.html` | Controller detection, mappings, the per-device settings key `device:<type>:<index + 1>` (R2.5 – R2.7) |
| `guitar.test.html` | Guitar logic: frets, strum, strum hold, Back tap and hold, tilt range, tilt glide, D-pad action, octave, number fields, ring time and MIDI note length, note strip (R4, R4.5.2 – R4.15, R5.4.2, R5.7, R5.8) |
| `drums.test.html` | Drum mapping, velocity triggers, custom mapping (R4b) |
| `keys.test.html` | Computer keyboard instrument, keyboard drums and numpad kit, `KeyboardDevice` (R4c) |
| `menu-nav.test.html` | Gamepad menu navigation, guitar rotation, which settings fields are shown, the tilt glide checkbox (R2.9, R2.12, R4.7.1, R4.14, design 7.2, 7.4) |
| `star-power.test.html` | Star power start, countdown and setting (R5.5, F11) |
| `pluck.test.html` | Karplus-Strong string rendered offline, strum hold (R3.4, R4.7.2) |
| `bass.test.html` | Bass source rendered offline, strum hold (R3.4.1, R4.7.2) |
| `effects.test.html` | Effect presets Clean, Crunch, Epic (R3.6) |
| `highway.test.html` | The highway view on its own (notes end and are removed without the simple view), draw order, trail width, lane drawing on a real canvas without errors (R5.4 – R5.4.5, R5.7, R5.8) |
| `app-smoke.test.html` | Loads `src/index.html` in a frame, starts it with the keyboard, plays and switches view, language and keyboard mode; fails on any uncaught error, rejection or `console.error` |

Shared helpers: `test-runner.js` (checks, sections, safe module loading, PASS/FAIL title) and `offline-audio.js` (OfflineAudioContext rendering and level/pitch measures).

## How a page reports

Every page ends with its title set to `PASS n/n passed` or `FAIL n/m passed`, and lists every check. A page never hangs: a module that cannot be loaded or a missing export is a FAIL check (modules are loaded with `s.load()`, not static imports), a check or section that throws is a FAIL, and a watchdog finishes the page with FAIL if it does not get to the end. Checks for behaviour that is designed but not built yet are expected to FAIL until the developers add it.

## Run in a browser

ES modules do not load from `file://`, so serve the repository root with any static server and open the pages, for example:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/tests/
```

(This is only for the test pages; the published app needs no setup.)

## Run headless (all pages at once)

`run-headless.mjs` starts its own static server for the repository root, opens every `tests/*.test.html` in one headless Chromium (all pages at the same time, each in its own browser context), waits up to 60 s per page for PASS or FAIL, prints the FAIL lines and exits with 1 on any FAIL or timeout (0 when all pass, 2 on setup errors). It needs Node.js 18+ and Playwright, which are developer tools only:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/run-headless.mjs
```

Options: `--browser <path>` (or `CHROME_PATH`) to use an installed Chrome/Chromium instead of Playwright's, `--base-url <url>` to use a server that is already running, `--timeout <ms>` per page, and page file names to run only some pages, e.g. `node tests/run-headless.mjs guitar.test.html keys.test.html`.

## Continuous integration

The `test` job in `.github/workflows/pages.yml` runs the same script on every push and pull request to `main` (design 10). The `deploy` job needs it, so the app is only published when every page passes.
