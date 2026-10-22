# Music Sandbox

A web-based music sandbox where game controllers become instruments. Plug in a Guitar Hero guitar or a regular gamepad and play directly in the browser.

The app is published as a static website on GitHub Pages.

## Status

Requirements and design are written in [`docs/`](docs/).

Current state: milestones 1-5 are implemented.

- Input and debug: start screen, controller detection, one lane per controller, per-controller settings with a debug view, settings saved in the browser, English and Swedish.
- Guitar: five frets with strum, restrum, mute and chords, key and scale per controller, a synthesized plucked string (no recordings) or a General MIDI sound. Whammy bends the pitch and tilt swells the volume; both can be switched per controller.
- Drums (regular gamepad by default) and a gamepad guitar/bass mode.
- Computer keyboard as a piano, hidden by default (keyboard toggle in the top bar).
- Two views: a highway where notes travel toward you with sustain trails, and a simple view with note names per fret.
- Test pages under [`tests/`](tests/index.html) (open through a local server).

Some defaults (whammy/tilt behavior, sounds) are marked *provisional* in the [design](docs/design.md) and need testing on the real guitar.

## Overview

- The page detects which controllers are connected.
- A guitar controller (e.g. Guitar Hero Xplorer) automatically becomes a guitar.
- A regular gamepad becomes drums by default, but the instrument can be changed.
- Several controllers at once become several instruments, one per controller.
- Sound is either MIDI tones or synthesized sounds, possibly selectable.
- The screen shows which notes are being played.

## Documentation

- [Requirements](docs/requirements.md) – core requirements and open questions.
- [Design](docs/design.md) – architecture, file structure and module design.
