# Decisions to review

This folder holds the decisions made while implementing that the owner still needs to review, **one Markdown file per decision**.

## File names

`<importance-number>-<short-slug>.md` (e.g. `2-tilt-smoothing.md`)

- importance number (the first digit) = how important it is for the owner to review the decision: **0** = most critical (changes how the app fundamentally sounds, behaves or plays, or what the user experiences a lot) … **9** = tiny details with probably no impact (internal names, debug handles, cosmetic font sizes).
- Older files, split from the old single-file log, also carry the original decision number after the importance number (`<importance-number>-<nn>-<short-slug>.md`, e.g. `3-12-audio-routing-limiter.md` is decision 12) and keep it. New decisions get no decision number.

Files therefore sort by importance first.

Each file has the decision text verbatim (Decision / Why / Alternatives / Where), the milestone section it came from, and an `Importance:` line with a short reason for the rating.

## Rules

- This folder is committed. Each decision file is committed when the decision is taken, so the history shows what was decided and when, also if a decision later turns out to be wrong.
- Once a decision has been reviewed and written into the docs ([requirements.md](../requirements.md), [design.md](../design.md)), its file is deleted in the same commit as the doc change; the file stays in the git history.
- Decisions taken by a bot during an unattended build (see [process.md](../process.md)) are logged here like any other decision and reviewed afterwards.

## Original header of the old `decisions-review.md`

Running log of decisions made while implementing milestones 2-5 while the owner was away.
Each entry: **what** – why – alternatives – where.
