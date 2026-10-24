# Names of the test seams the pages expect

Importance: 4 – the developer bots must implement these names (or change the tests).

## Decision
Where the design describes behaviour without naming a function, the tests use these names (now listed in design 9.2, "Test seams"):
- R2.7: `deviceSettingsId(type, index)` in `store.js` (`device:<type>:<index + 1>`), exposed as `Device.settingsId`; fake devices in the tests use `id = settingsId`.
- MIDI note length / strum hold: `trackerConfig(sound)` in `audio-engine.js` (the `VoiceTracker` config for a sound) and `VoiceTracker.holdEnd(event, now)`.
- Guitar rotation (R2.12): `rotateIntent(intent)` and `menuRotated(device)` in `menu-nav.js` (rotated only for detected type `guitar`).
- Start in menus: `navigate('start')` on `MenuNavigator` and `SettingsPanel` presses a button or toggles a checkbox and never closes.
- D-pad and range toasts: `ui/lane-actions.js` with `rangeShiftedChange(base, scaleLength, stored)` and `dpadChange(action, dir, settings, instrument)`, both returning `{ changes, toast }`.
- Effects: `EFFECT_ORDER`, `EFFECT_PRESETS`, `EffectChain(context)` with `input`, `output`, `setPreset(name)`, `preset`, `kinds()` (e.g. `['drive', 'cabinet', 'echo', 'reverb']`).
- Bass: `BassSource(context, destination, params)` with the `PluckSource` interface (`noteOn(id, midi, velocity, event)`, `noteOff`, `bend`, `holdEnd`), `DEFAULT_SOURCES.bass = 'bass'`.
- Keyboard drums: `DEFAULT_KEYS_DRUM_MAP`, `DEFAULT_NUMPAD_DRUM_MAP` in `keys.js`, `Keys` options `keysMode`, `keysDrumMap`, `numpadDrumMap`; a mode change's `noteOff`s may be returned by `configure()` or sent with the next `handle()` (the test accepts both).
- Note names: global setting `noteNames` (`international` / `language`).
- Star power is tested through `createInstrument(device, instrument, settings)` from `setup.js`, so the device's whammy/tilt and the `starPower` setting decide, whatever option names the guitar uses inside.

## Why
Tests need a callable seam; plain names close to the design's wording are the least surprising for the developers. Testing star power through `createInstrument` avoids inventing guitar option names.

## Alternatives
Test only through `main.js` (not loadable without a full page); leave the cases out until the code exists.

## Where
Design 9.2, `tests/guitar.test.html`, `menu-nav.test.html`, `keys.test.html`, `effects.test.html`, `bass.test.html`, `star-power.test.html`, `detect.test.html`.
