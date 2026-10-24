# Note names (R6.3) implemented in build 1

**Decision:** The note names setting (R6.3, design 8) is implemented in build 1 as designed: `notes.names` in `lang/common.json` and `sv.json`, the global `noteNames` setting (default `international`), the top-bar select shown only for a language with its own list, and `theory.js` using the active list. It was not named in the build's scope, but the D-pad "key" toast (R4.15) names the key with it.

**Why:** The key toast and the root select would otherwise show B in Swedish where the design says the user may choose H.

**Alternatives:** Use the international names in the toast and leave R6.3 to a later build.

**Where:** `src/js/i18n/i18n.js`, `src/js/audio/theory.js`, `src/js/main.js` (`applyNoteNames`), `src/index.html`.

Milestone: Build 1 – guitar, tilt and whammy

Importance: 6 – adds a top-bar control in Swedish.
