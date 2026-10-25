# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages. Light-blue blueprint theme (`css/style.css`, `favicon.svg`).

## Open

**Preferred:** open [`garagebox.code-workspace`](../../garagebox.code-workspace) with the VS Code **Live Preview** extension (`ms-vscode.live-server`). On start:

- Live Preview servers, one per workspace folder, App first: App `http://127.0.0.1:5500/` (`src/`, WS `:5501`), Blueprints `http://127.0.0.1:5502/` (`docs/blueprints/`, WS `:5503`). Each server uses HTTP N and WebSocket N+1, hence 5500/5502. The Repo folderOpen task starts them with `livePreview.start.preview.atFileString` using **relative** paths: `index.html` → App (Repo has no root `index.html`; App is listed before Blueprints), `meta.json` → Blueprints (it exists only in this folder). It then opens the catalog `http://127.0.0.1:5502/`. Absolute `${workspaceFolder:…}` paths were dropped because Live Preview resolves them to the first folder (Repo), so `:5502` never listened; running the folder tasks via `workbench.action.tasks.runTask` was dropped because it raised a confirmation prompt and timed out. The folder-scoped tasks **`Live Preview: App`** (`src/.vscode/tasks.json`) and **`Live Preview: Blueprints`** (`.vscode/tasks.json` in this folder) remain for manual use. Per-folder `.vscode/settings.json` pins `livePreview.portNumber` (App `5500`, Blueprints `5502`). Requires the extension, **Developer: Reload Window** after installing it, and opening `garagebox.code-workspace` (not the folder alone).
- The start task waits until both URLs return a page containing `GarageBox` before it opens Blueprints
- **Blueprints** opens in the **integrated** browser (`workbench.action.browser.open` with `openToSide: false`, so Group 1 / the active group, not beside; reused if already open). The workspace forces `livePreview.openPreviewTarget: "Embedded Preview"` and `livePreview.useIntegratedBrowser: true`, so Live Preview does not open an external browser by default
- **App** stays available on `:5500`; its preview may flash briefly when its server starts, then Blueprints takes the integrated browser — use **Copy App link** / **Copy Blueprints link** on the catalog (App in an external browser for Web Audio)
- Analytics: same Google tag as the app (`js/analytics.js`)

**This folder alone (no Live Preview):** `python3 -m http.server 5502 --bind 127.0.0.1 --directory docs/blueprints` (from the repo root), then open `http://127.0.0.1:5502/`.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`. The tag `needs-audio` means the page needs an external browser for sound. The sidebar filters by tag (Match any / Match all, tags sorted most used first, grey tags last) and by status (All / Ready / Draft). **Copy Blueprints link** first loads `http://127.0.0.1:5502/` and only copies it when the page contains `GarageBox`. Paths are relative so the catalog works on its own port and under a repo-root server.
