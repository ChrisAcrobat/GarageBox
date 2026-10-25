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
- **Local preview:** open `garagebox.code-workspace` with the VS Code **Live Preview** extension (`ms-vscode.live-server`) installed. The workspace is multi-root (Repo, App = `src/`, Blueprints = `docs/blueprints/`), and Live Preview runs one server per folder with that folder as web root. Each server takes HTTP on port N and its WebSocket (auto-refresh) on N+1, so **App** gets HTTP `:5500` (WS `:5501`) and **Blueprints** HTTP `:5502` (WS `:5503`); App must start first so the ports land that way. On start, a Repo folderOpen task (`.vscode/tasks.json`) frees ports `5500`–`5503` (leftover servers, never an editor process), starts the App server with `livePreview.start.preview.atFileString` and the **relative** path `index.html` and waits until `5500`/`5501` listen, then starts the Blueprints server the same way with the relative path `meta.json` and waits for `5502`, then waits until both `http://127.0.0.1:5500/` and `http://127.0.0.1:5502/` return a page containing `GarageBox`, and only then opens the **Blueprints catalog** (`http://127.0.0.1:5502/`, not `meta.json`) in the integrated browser in Group 1 (`openToSide: false`, `reuseUrlFilter`). Live Preview resolves a relative path to the first workspace folder that contains it: Repo has no root `index.html` and App comes before Blueprints, so `index.html` → **App**; `meta.json` exists only at `docs/blueprints/meta.json`, so it → **Blueprints**. Two earlier approaches were dropped: absolute `${workspaceFolder:…}` paths make Live Preview resolve the workspace as Repo (first folder), so `:5502` never started; and running the folder-scoped tasks through `workbench.action.tasks.runTask` from the chain raised a “run task?” confirmation and raced the port wait, so the start step timed out. The folder-scoped `type: Live Preview` tasks **`Live Preview: App`** (`src/.vscode/tasks.json`) and **`Live Preview: Blueprints`** (`docs/blueprints/.vscode/tasks.json`) remain for manual runs only. Per-folder settings pin the ports (`src/.vscode/settings.json` `livePreview.portNumber: 5500`, `docs/blueprints/.vscode/settings.json` `5502`; the workspace default `5500` applies to Repo). The workspace sets `livePreview.openPreviewTarget: "Embedded Preview"` and `livePreview.useIntegratedBrowser: true`, overriding a user-level External Browser preference, and `livePreview.tasks.runTaskWithExternalPreview: false`, so Live Preview never opens an external browser (the App start may briefly show an embedded/integrated App tab before Blueprints takes over); the final step opens **Blueprints** (`http://127.0.0.1:5502/`) in the **integrated** browser via `workbench.action.browser.open` (reusing the tab, so it replaces any App/`meta.json` preview the starts opened). `livePreview.serverKeepAliveAfterEmbeddedPreviewClose: 0` keeps the App server up after focus moves to Blueprints. Requires the extension installed, **Developer: Reload Window** after installing, and opening `garagebox.code-workspace` (not the folder alone). Saved file changes (also from bots) refresh open previews (`livePreview.autoRefreshPreview`). App stays on `:5500` (its preview may flash briefly at start); **Copy App link** on the catalog copies `http://127.0.0.1:5500/` for an external browser. Without Live Preview, `python3 -m http.server PORT --bind 127.0.0.1 --directory FOLDER` still serves a single folder. Blueprints use a light-blue blueprint theme (`css/style.css`, `favicon.svg`).
- **Catalog:** `index.html` lists the entries of `meta.json`, each as a link to `/{name}/` with its title, comment, tags and whether it is ready or a draft. It also offers **Copy App link** (`http://127.0.0.1:5500/`) and **Copy Blueprints link** (`http://127.0.0.1:5502/`); the Blueprints link is only marked verified and copied after the catalog has loaded that URL and found `GarageBox` in its HTML, otherwise it says the Blueprints preview is not up yet. The sidebar has a ready toggle (**All** / **Ready** / **Draft**) combined (AND) with the tag filter; tags are sorted by use count (most used first), and in Match all the grey tags that would empty the result go last.
- **`meta.json`:** `{ "blueprints": [ … ] }`, one object per blueprint with
  - `name`: the exact folder name;
  - `title`: shown in the catalog;
  - `comment`: a short description;
  - `tags`: an array of strings; the catalog sidebar lists every tag, most used first, and filters on them (selectable: match any selected tag (OR, default) or match all (AND)). The tag `needs-audio` means the page needs an external browser for sound;
  - `ready`: `true` when ready, `false` while it is a draft (there is no separate status text).
- **One folder each:** a blueprint lives in `docs/blueprints/{name}/`, normally with its own `index.html`. A new blueprint gets its folder and a `meta.json` entry in the same commit.
- **Analytics:** the published app and Blueprints use the same Google Analytics tag (`G-KVKVFNN711` in `src/index.html` and `docs/blueprints/js/analytics.js`). New blueprint pages should load that script (see the catalog and `bass-sound/`).
- **Standalone:** a blueprint imports nothing from `src/`; code it needs is copied or written into its folder. The shared look comes from `/css/style.css` under the blueprints root. Fetching anything from GitHub (or other outside sources) needs the owner's approval first.
- **Language:** English by default, no i18n; exceptions are allowed when a blueprint needs them.
- **Who writes them:** the design bot owns `docs/blueprints/` (as all of `docs/`). Developer bots do not write blueprints unless asked.


## 6. Pull from origin before committing

Before a bot makes commits on a branch, it first pulls from origin so the work starts from the latest remote state (owner decision 2026-10-25).

- **Fetch first:** run `git fetch origin` and check how far the branch is ahead of and behind its upstream.
- **Integrate before committing:** on `main`, rebase onto `origin/main` when possible (`git pull --rebase` or `git rebase origin/main`); on another branch, update it from its upstream the same way. Local commits that are not yet on origin are kept on top of the remote ones.
- **Conflicts:** a conflict is resolved before any new commit is made. If it touches another bot's area (e.g. `src/` for the design bot), that bot or the owner resolves it.
- **Never push** unless the owner asks for it; pulling first does not change that.
