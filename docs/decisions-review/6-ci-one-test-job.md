# CI: one test job, all pages at once, deploy needs it

Importance: 6 – decides when the app is published.

## Decision
`.github/workflows/pages.yml` gets one `test` job (push and pull request to main, manual runs): Node 20 and `playwright@1.64.1` with Chromium installed in the job only (`npm install --no-save --no-package-lock`), the repository root served with `python3 -m http.server`, then `node tests/run-headless.mjs --base-url http://127.0.0.1:8000/ --timeout 60000`. The script opens every `tests/*.test.html` at the same time in one headless Chromium, one browser context per page (separate `localStorage`), waits up to 60 s per page for its PASS/FAIL title, prints the FAIL lines and exits 1 on any FAIL or timeout (2 on setup errors). `deploy` keeps its steps, gets `needs: test` and `if: github.event_name != 'pull_request'`; its Pages permissions and the `pages` concurrency group moved from the workflow to the deploy job, so pull request test runs neither wait for nor block a deploy. The script also starts its own static server when no `--base-url` is given, so it runs locally with one command.

## Why
One browser is fast (the full run takes about 4 s locally) and gives one readable log; contexts keep the pages' storage apart. Pinning Playwright keeps CI reproducible; it is the version the script was tried with.

## Alternatives
A matrix job per page (more runners, scattered logs); pages one after another (slower, a hang delays the rest); running tests only on pull requests; a test job that only warns.

## Where
`.github/workflows/pages.yml`, `tests/run-headless.mjs`, `tests/README.md`, design 9.2 and 10.
