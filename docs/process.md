# Process: build, refactoring and QA

How a piece of work goes from the docs to a finished build. The design bot writes requirements, design, README and tests and never writes in `src/`; developer bots own `src/`.

## 1. Before a build starts

- The design bot asks the owner whether the build is **attended** or **unattended**.
  - **Attended:** the owner can answer questions. Unclear points are asked to the owner (one question at a time), and work on that point waits for the answer.
  - **Unattended:** nobody can answer questions for now. The bot that hits an unclear point does not stop: it takes the most reasonable decision, logs it as a decision file in [`docs/decisions-review/`](decisions-review/README.md) (decision, why, alternatives, where, importance) and commits it right away. The owner reviews and confirms these decisions afterwards.
- The default is attended: when in doubt, ask the owner.

## 2. Steps

1. **Build.** A developer bot implements the agreed part from the docs, runs all tests, and finishes by cleaning up its own code (no behaviour change). Status: "Arbetar", then "Väntar på QA". A status names what the bot is waiting for and never says "Klar".
2. **Refactoring.** A separate refactoring bot reviews the code with fresh eyes and refactors it (structure, names, duplication) **without changing behaviour**. All tests must give the same result before and after. Exception: if a module is already hard to work with before a large build, it may be refactored before that build instead.
3. **QA.** The design bot tests the result against the docs (requirements, design, tests).
4. **Owner test.** When QA passes, the owner tests on the real hardware (e.g. the guitar). Defects found there go through the same defect flow as QA defects. While the owner tests, the build bots have the status "Väntar på användartest". The design bot gives the owner the test protocol in the chat as simple steps, one at a time: each step is a short description of what to do and what should happen, followed by a question with selectable answers (for example "Looks good", "Wrong" with free text, "Skip"). The design bot keeps track of the answers, sends any defects to the bot that caused them, and continues with the next step when the owner is back.

## 3. QA defects

1. **QA report.** For each defect: the requirement ID, what should happen, what happens, and how to reproduce it.
2. **Sorting.**
   - Wrong code goes back to the bot that made the defect, since it has the context (a test that breaks after the refactoring goes to the refactoring bot).
   - An unclear or contradictory doc is the design bot's defect: it fixes the doc, and if that needs a new decision it asks the owner (attended) or decides and logs it (unattended).
3. **Fix.** The bot sets its status to "Åtgärdar QA-fel", fixes the defect, adds a test that catches it where possible, runs all tests and sets "Väntar på QA" again.
4. **Re-test.** The design bot re-tests the failed points and runs the whole test suite to make sure nothing else broke.
5. **Limit.** If the same point still fails after **5 rounds**, the design bot takes it to the owner (attended). In an unattended build the work may go on up to **10 rounds**; after that the design bot decides how to proceed (e.g. a different approach or a simpler requirement), logs the decision in `docs/decisions-review/` and the point is reviewed with the owner afterwards.

## 4. Done

When QA and the owner test pass, the developer bots set their status to "Färdig, redo att tas bort". Only the owner deletes bots.

Changes made during the owner test (tuning, small additions) go through refactoring and QA too. Do this as soon as the owner has answered all test questions that concern a bot's work, without waiting for the rest of the protocol: the refactoring bot reviews the src commits made since the last refactoring, the design bot runs QA, and if neither finds more work for that bot, it sets "Färdig, redo att tas bort" (owner decision 2026-10-24).

## 5. Blueprints

Blueprints are visual and audio experiment and reference pages: a look, a sound or an interaction is tried out and agreed on in a blueprint before it is built into the app (owner decision 2026-10-25).

- **Location:** `docs/blueprints/`. Only `src/` is published to GitHub Pages, so blueprints are never published; they are opened locally.
- **Own web root:** `docs/blueprints/` can be served as its own site root (e.g. `python3 -m http.server 8000 --directory docs/blueprints`). Paths in blueprint pages are **root-relative to that folder** using relative URLs (`css/style.css`, `meta.json`, `./name/`), so the same files also work when the **repository root** is the server (Live Preview on **Repo**) at `/docs/blueprints/`.
- **Local preview:** open `music-sandbox.code-workspace`. On start, **App** (`:5501`) and **Blueprints** (`:5502`) are served by silent Python `http.server` folderOpen tasks (no preview from those tasks). A Repo folderOpen task waits until both listen, then opens both URLs in the integrated browser in the primary editor group (`openToSide: false` / Group 1), App then Blueprints (tab order), then App focused via reuse. `reuseUrlFilter` per port reuses an existing tab instead of opening a duplicate when the workspace is reopened. Live Preview’s own embedded preview always opens beside (Group 2) and is not used for auto-open. Repo `index.html` is a manual link page only.
- **Catalog:** `index.html` lists the entries of `meta.json`, each as a link to `/{name}/` with its title, comment, tags and whether it is ready or a draft.
- **`meta.json`:** `{ "blueprints": [ … ] }`, one object per blueprint with
  - `name`: the exact folder name;
  - `title`: shown in the catalog;
  - `comment`: a short description;
  - `tags`: an array of strings;
  - `ready`: `true` when ready, `false` while it is a draft (there is no separate status text).
- **One folder each:** a blueprint lives in `docs/blueprints/{name}/`, normally with its own `index.html`. A new blueprint gets its folder and a `meta.json` entry in the same commit.
- **Standalone:** a blueprint imports nothing from `src/`; code it needs is copied or written into its folder. The shared look comes from `/css/style.css` under the blueprints root. Fetching anything from GitHub (or other outside sources) needs the owner's approval first.
- **Language:** English by default, no i18n; exceptions are allowed when a blueprint needs them.
- **Who writes them:** the design bot owns `docs/blueprints/` (as all of `docs/`). Developer bots do not write blueprints unless asked.
- The `placeholder` blueprint is only there to test the catalog and is removed when the first real blueprint is added.

