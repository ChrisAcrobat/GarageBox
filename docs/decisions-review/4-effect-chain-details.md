# Effect chain: build details

Importance: 4 – sound details, starting points to tune by ear.

## Decision
- Reverb impulse responses are stereo decaying noise from a seeded random generator (the same IR on every load), cached per AudioContext and length.
- Drive: the WaveShaper curve is `tanh` over ±40 and the gain in front is drive/40 (the shaper only sees −1..1), so ×4 / ×20 drive is applied exactly without clipping the shaper input.
- Cabinet: high-pass 80 Hz (Q 0.7), peaking 1.5 kHz (Q 0.8, +3 dB crunch / +4 dB epic), low-pass 5 / 4.5 kHz (Q 0.7).
- Level match: output gain 0.3 (crunch) and 0.25 (epic): with a 0.3 sine at 220 Hz clean measures −13.5 dB, crunch about −13.5 dB and epic −13.4 dB.
- Reverb and echo are added to the dry signal (dry stays at 100 %; echo 25 %, reverb 15 % / 30 %).
- `setPreset` builds the new preset beside the old one and crossfades the two input sends (time constant 10 ms); the old preset's nodes keep ringing out and are disconnected after 3.5 s. `clean` connects the input straight to the output (bypass).
- The Channel (audio-engine.js) puts the chain between the instrument gain and the master gain for every non-drum channel and switches it from the sound config's new `effect` field (set by `guitarSound`/`keysSound` from the `effect` setting). The keyboard's guitar keys part uses the same effect setting as its piano part.

## Why
A seeded IR keeps the rendered tests deterministic (a random IR made the "crunch: no echo" check depend on chance). The crossfade avoids clicks without cutting ringing notes or tails.

## Alternatives
`Math.random` IR; rebuild in place (cuts the tail); a separate effect setting for the keyboard's guitar keys.

## Where
`src/js/audio/effects.js`, `src/js/audio/audio-engine.js` (Channel), `src/js/instruments/setup.js`; design 5 "Effects", R3.6.
