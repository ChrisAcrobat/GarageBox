# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages.

## Open

**Preferred:** open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace). On start:

- App: `http://127.0.0.1:5501/` (own web root)
- Blueprints: `http://127.0.0.1:5502/` (own web root)
- The repo launcher (Live Preview) opens App in a new tab and sends the first tab to Blueprints

**This folder alone:** `python3 -m http.server 5502 --bind 127.0.0.1 --directory docs/blueprints` (from the repo root), then open `http://127.0.0.1:5502/`.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`. Paths are relative so the catalog works on its own port and under a repo-root server.
