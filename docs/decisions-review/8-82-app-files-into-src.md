# 82. All app files moved into src/

**Decision:** **All app files moved into `src/`; the Pages workflow publishes exactly `src/`; `tests/` stays at the repository root and imports from `../src/`.**

**Why:** Owner's request (also for the future template): a clear split between what is published and what is not.

**Alternatives:** Tests inside `src/` (would be published); keep the old file list in the workflow.

**Where:** repo layout, `.github/workflows/pages.yml`, R7.3, design 2 and 10.

Milestone: Gamepad menu navigation

Importance: 8 – Repo layout per owner request; no user impact.
