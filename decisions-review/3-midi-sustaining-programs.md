# MIDI note length in the level estimate: which programs sustain

Importance: 3 – decides how long MIDI trails stay at full opacity (R4.7.1, R5.4.2).

## Decision
`trackerConfig(sound)` (audio-engine.js) gives a MIDI melodic sound the `sustained` model (full level until noteOff) when its General MIDI program (0-based) is 16–23 (organs, accordion, harmonica), 40–44 (violin … tremolo strings), 48–54 (ensembles, synth strings, choir, voice) or 56–95 (brass, reeds, pipes, synth leads, synth pads). Every other melodic program gets the `decaying` model (−60 dB after 12 s, the old `sustained` formula), including pizzicato strings (45), harp (46), timpani (47) and orchestra hit (55), which are plucked or struck. After a noteOff a MIDI voice falls linearly to 0 over release 0.3 s + the note's fade (design: "release 0.3 s plus the linear fade"). The ring time is never used for MIDI (`guitarSound`/`keysSound` leave `decay` out for the MIDI source). The keyboard's piano part (program 0) therefore uses `decaying`, exactly the estimate it had before. The `model` field is gone from the guitar and keys sound configs; only drums keep `model: 'oneShot'`.

## Why
Design 5 "Tracker" names the families but not the program numbers. Ranges by GM family are the simplest exact reading; the four excluded programs sit inside sustaining families but do not sustain in tinysynth.

## Alternatives
Read the envelope from tinysynth's program table (couples the visuals to the vendored library's internals); treat every MIDI program as sustaining (a piano trail would stay full for ever without noteOff).

## Where
`src/js/audio/audio-engine.js` (`isSustainingProgram`, `trackerConfig`, `VoiceTracker`), `src/js/instruments/setup.js`; design 5 "Tracker", R4.7.1, R5.4.2.
