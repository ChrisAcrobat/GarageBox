# 66. Start screen Start button and audio wait

**Decision:** *(Partly superseded 2026-10-22: only Start starts, not D-pad right.)* **Start screen: new visible "Start" button (gamepad cursor on it when a controller is connected); Start or D-pad right on any controller starts. Because a gamepad press is no user gesture, the app waits up to 0.5 s for the AudioContext to run and otherwise keeps the screen with a hint that one click or key press is needed.**

**Why:** Honest about the browser's autoplay rule instead of hiding the screen with no sound.

**Alternatives:** Hide the screen anyway and rely on the next click (`keepAudioAlive`); no gamepad start.

**Where:** `start-screen.js`, `main.js onGamepadStart`, `index.html`.

Milestone: Gamepad menu navigation

Importance: 3 – First thing every user experiences, including the autoplay hint.
