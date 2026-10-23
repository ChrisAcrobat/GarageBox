# Effect setting stored before the effect chain exists

**Decision:** The `effect` device setting (`clean` / `crunch` / `epic`, default `clean`) and its select (right after the sound fields, then D-pad action) are added in build 1, and the D-pad "effect" action cycles it in the order `CHOICES.effect` (clean, crunch, epic, wrapping). The setting changes nothing in the sound yet: `effects.js` / `EffectChain` and their presets belong to the effects build (bot 2), which should take its order from `EFFECT_ORDER` and may replace `CHOICES.effect` with it. The ring time (`decay`) default also stays 4 s here; the 10 s default (R4.7.1) comes with that build.

**Why:** R4.15 (D-pad effect, with a toast) and the panel order in the build brief need the setting now; the sound processing is out of this build's scope.

**Alternatives:** Hide the effect select and the D-pad "effect" option until the chain exists; import a stub `effects.js` (would collide with bot 2's file).

**Where:** `src/js/settings/store.js` (`DEFAULTS.device.effect`, `CHOICES.effect`), `src/js/ui/lane-actions.js` (`effectChange`), `src/js/ui/settings-panel.js`.

Milestone: Build 1 – guitar, tilt and whammy

Importance: 3 – between the builds the effect select and D-pad effect toasts change no sound.
