# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages.

## Open

**Preferred (Live Preview):** open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace). On start, the repo root launcher (`/index.html`) opens this catalog in a new tab and sends the first tab to the app at `/src/`.

**This folder alone:** serve it as the web root, e.g. `python3 -m http.server 8000 --directory docs/blueprints`, then open `http://127.0.0.1:8000/`. Paths are relative (`css/style.css`, `meta.json`), so both modes work.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`.
