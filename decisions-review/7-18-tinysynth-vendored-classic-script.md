# 18. webaudio-tinysynth vendored unmodified, loaded as classic script

**Decision:** **webaudio-tinysynth 1.1.4 (commit 3d75aee) vendored unmodified, loaded as a classic `<script>` on first use**; a subclass disables its own AudioContext via a prototype getter for `internalcontext`, then `setAudioContext(sharedContext, gainNode)`.

**Why:** The file is an IIFE using `this` = window, so it cannot be imported as an ES module; no modification keeps updates easy.

**Alternatives:** Patch the file into a module; a static `<script>` tag in index.html.

**Where:** `js/audio/midi-source.js`, `vendor/webaudio-tinysynth/`.

Milestone: Milestone 3 – more instruments

Importance: 7 – Integration technique; no audible effect.
