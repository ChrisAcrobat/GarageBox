# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages. Light-blue blueprint theme (`css/style.css`, `favicon.svg`).

## Open

**Preferred:** open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace) with the VS Code **Live Preview** extension (`ms-vscode.live-server`). On start:

- Live Preview servers, one per workspace folder, App first: App `http://127.0.0.1:5500/` (`src/`, WS `:5501`), Blueprints `http://127.0.0.1:5502/` (`docs/blueprints/`, WS `:5503`). Each server uses HTTP N and WebSocket N+1, hence 5500/5502.
- The start task waits until both URLs return a page containing `GarageBox` before it opens Blueprints
- **Blueprints** opens in the integrated browser (Group 1; reused if already open)
- **App** is not auto-opened — use **Copy App link** / **Copy Blueprints link** on the catalog (App in an external browser for Web Audio)
- Analytics: same Google tag as the app (`js/analytics.js`)

**This folder alone (no Live Preview):** `python3 -m http.server 5502 --bind 127.0.0.1 --directory docs/blueprints` (from the repo root), then open `http://127.0.0.1:5502/`.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`. The tag `needs-audio` means the page needs an external browser for sound. Paths are relative so the catalog works on its own port and under a repo-root server.
