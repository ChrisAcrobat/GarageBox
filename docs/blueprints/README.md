# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages. Light-blue blueprint theme (`css/style.css`, `favicon.svg`).

## Open

**Preferred:** open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace). On start:

- Servers: App `http://127.0.0.1:5500/`, Blueprints `http://127.0.0.1:5501/` (own web roots via `--directory`)
- **Blueprints** opens in the integrated browser (Group 1; reused if already open)
- **App** is not auto-opened — use **Copy App link** on the catalog, then paste into an external browser (Web Audio)

**This folder alone:** `python3 -m http.server 5501 --bind 127.0.0.1 --directory docs/blueprints` (from the repo root), then open `http://127.0.0.1:5501/`.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`. Paths are relative so the catalog works on its own port and under a repo-root server.
