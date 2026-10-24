# Blueprints

Local visual and audio experiment and reference pages (see [docs/process.md §5](../process.md#5-blueprints)); they are not published. To open them, serve this folder as the web root, e.g. `python3 -m http.server 8000 --directory docs/blueprints` from the repository root, and open http://localhost:8000/. The catalog (`index.html`) lists the entries in `meta.json`; each blueprint lives in its own folder, `/{name}/`.

## Live Preview (VS Code)

Open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace) in VS Code/Cursor (File → Open Workspace from File…). That workspace has three roots: **Repo**, **App** (`src/`), and **Blueprints** (this folder). Microsoft [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) (`ms-vscode.live-server`) starts a separate server for each root you preview from, so `/` in App is `src/` and `/` here is `docs/blueprints/`.

Preview any `index.html` under **App** or **Blueprints** (preview button, or Command Palette → “Live Preview: Show Preview”). Hover the Live Preview status-bar item to see which ports belong to which root.

On workspace open, Live Preview starts automatically for **App** and **Blueprints** (`runOn: folderOpen` in each folder’s `.vscode/tasks.json`; the workspace sets `task.allowAutomaticTasks` to `on`). The first time, allow automatic tasks if VS Code/Cursor still asks (or use Command Palette → “Tasks: Manage Automatic Tasks”).

