# 83. App rename in the UI without the tagline

- **Decision:** The page title, `app.title` (top bar and start screen), the device information report header, the startup error log and the CSS header comment now say "GarageBox - Music Sandbox". The test page titles were renamed too. The tagline "Your controllers are the band." is not shown on the start screen yet.
- **Rationale:** R5b.1 requires the name everywhere and only allows the tagline ("may"); keeping the first developer-bot task small.
- **Alternatives:** Show the tagline under the start-screen heading (needs a translated string in en.json/sv.json).
- **Where in the app:** `src/index.html`, `src/lang/common.json`, `src/js/ui/debug-view.js`, `src/js/main.js`, `src/css/style.css`, `tests/*.html`.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

Importance: 7 – Visible on every page title, but only a name change the owner already chose; already written into the docs.
