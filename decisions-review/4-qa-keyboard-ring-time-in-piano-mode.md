# QA: the keyboard panel shows ring time and tone in Piano mode, also with the MIDI piano

Importance: 4 – which fields the keyboard's settings panel shows.

Section: QA run 2026-10-23 (docs/process.md step 3).

## Decision
I keep the `plucked` rule in `src/js/ui/settings-panel.js`. On the keyboard's panel, ring time and tone are shown in Piano mode whatever the piano's source, and hidden in Drums mode. Design 7.2 now states this as an exception to "never with the MIDI source". This is not a fault: the keyboard part of the rule was there before the build bots (205e24d already had it), and Build 3 only added "not in Drums mode" (R4c.13).

## Why
On the keyboard these two fields set the guitar keys 1–5, which always use the plucked string (setup.js: `guitarSound(settings, 'guitar', 'pluck')`). Hiding the fields with the MIDI piano would leave the guitar keys' ring time with no way to set it. R4.7.1 literally says the field is hidden "while the MIDI-style sound source is used". On the keyboard, though, a generated sound (the guitar keys) is always in use. Whether R4.7.1 should say so, or the field should carry a hint such as "guitar keys", is left as an open question in the QA report.

## Alternatives
- Hide the fields with the MIDI piano. The guitar keys would then have no ring time setting.
- Label the fields "Guitar keys: ring time". That is a UI change in `src/`.

## Where
docs/design.md 7.2 (fields shown where they apply); `src/js/ui/settings-panel.js` (`plucked`); R4.7.1.
