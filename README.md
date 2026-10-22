# GarageBox - Music Sandbox

*Your controllers are the band.*

A web-based music sandbox where game controllers become instruments, so your controllers form a band. Plug in a Guitar Hero guitar or a regular gamepad and play directly in the browser.

The app is published as a static website on GitHub Pages.

## Status

Requirements and design are written in [`docs/`](docs/).

Current state: milestones 1-5 are implemented.

- Input and debug: start screen, controller detection, one lane per controller, per-controller settings with a debug view, settings saved in the browser, English and Swedish.
- Guitar: five frets with strum, restrum, mute and chords, key and scale per controller, a synthesized plucked string (no recordings) or a General MIDI sound. Whammy bends the pitch and tilt swells the volume; both can be switched per controller.
- Drums (regular gamepad by default) and a gamepad guitar/bass mode.
- Computer keyboard as a piano, hidden by default (keyboard toggle in the top bar).
- Two views: a highway where played notes travel away from you with sustain trails, and a simple view with note names per fret.
- Menus work with the controller: Start opens a controller's settings, the D-pad (or the guitar's strum bar) moves up/down, left/right changes a value or presses a button, Back closes. While a guitar's settings are open this way, the frets play directly without strumming, so you can try sounds while changing them. Settings opened with the mouse (⚙ button) leave the controller playing normally.
- The app is in [`src/`](src/index.html), which is the only folder published to GitHub Pages. Test pages are under [`tests/`](tests/index.html); serve the repository root with a local server to open both.

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

## Decision review

Decisions made during design or implementation are logged in the local folder `decisions-review/`, which is git-ignored and never committed. Each decision has its own file, written in English, with the decision, why it was made, the alternatives and where it applies.

- File name: `<importance-number>-<slug>.md`, e.g. `2-tilt-smoothing.md`. The importance number is a single digit: 0 means most critical to review (how the app sounds, behaves or plays), 9 means tiny details.
- The owner reviews the decisions one at a time, most important first.
- A reviewed decision is written into [`docs/requirements.md`](docs/requirements.md) and [`docs/design.md`](docs/design.md) (and the tests), then its file is deleted. The doc change is committed as its own commit, with the importance number and a short summary in the message, e.g. `Decision (importance 1): own bass sound`; older decisions that have an original number keep it, e.g. `Decision 86 (importance 1): own bass sound`.
- Decisions kept for a later experiment stay in the folder, marked as such.
- Open developer questions are answered only by updating the docs.

## Inspiration

GarageBox is inspired by Apple's GarageBand app. It is an independent hobby project and is not affiliated with, endorsed by or connected to Apple Inc. GarageBand is a trademark of Apple Inc.
