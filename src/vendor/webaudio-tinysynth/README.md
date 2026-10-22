# webaudio-tinysynth (vendored)

General MIDI synthesizer built on the Web Audio API, without samples (R3.3).

- Source: https://github.com/g200kg/webaudio-tinysynth
- Version: 1.1.4 (package.json), commit 3d75aee4b3f43cbd932265e7d60201fd5b770397 (2022-12-20)
- License: Apache License 2.0, see [LICENSE](LICENSE)
- `webaudio-tinysynth.js` is copied unmodified from the repository root.

The file is a classic script (an IIFE that sets `window.WebAudioTinySynth`), not
an ES module, so `js/audio/midi-source.js` loads it with a `<script>` element on
first use. No build step is needed.
