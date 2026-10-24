# Blueprints

Visual and audio experiment and reference pages for GarageBox - Music Sandbox. Local only; not published to GitHub Pages.

## Open

**Preferred:** open [`music-sandbox.code-workspace`](../../music-sandbox.code-workspace). On start:

- Servers: App `http://127.0.0.1:5500/`, Blueprints `http://127.0.0.1:5501/` (own web roots; start without opening pages by themselves)
- Editor: both pages open in Group 1 (App then Blueprints; App focused). If a tab for that port is already open, it is reused instead of duplicated
- Sound: the integrated browser often has no audio — use “Open in browser” when you need Web Audio

**This folder alone:** `python3 -m http.server 5501 --bind 127.0.0.1 --directory docs/blueprints` (from the repo root), then open `http://127.0.0.1:5501/`.

## Catalog

`index.html` reads `meta.json` (`blueprints` array: `name`, `title`, `comment`, `tags`, `ready`). Each blueprint lives in `{name}/`. Paths are relative so the catalog works on its own port and under a repo-root server.
