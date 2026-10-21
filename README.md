# Music Sandbox

A web-based music sandbox where game controllers become instruments. Plug in a Guitar Hero guitar or a regular gamepad and play directly in the browser.

The app is published as a static website on GitHub Pages.

## Status

Planning phase. Requirements and design are written in [`docs/`](docs/) before implementation starts.

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
