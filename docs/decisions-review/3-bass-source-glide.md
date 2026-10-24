# Bass source glides via per-voice detune

Importance: 3 – the bass source (docs only, not yet in the code) needs a defined glide behaviour.

**Decision:** design 5: with tilt glide the bass source sets both oscillators' `detune` to `(bend + glide) × 100`, immediately for a noteOn with `glide`, and with `setTargetAtTime` (0.015 s, like the pluck worklet's ~15 ms) on a `glide` event. Experiment E had no bass source, so this is designed, not taken from code.

**Rationale:** same model as the MIDI source (detune = bend + glide) and the same smoothing time as the pluck worklet.

**Alternatives:** no glide on the bass source (only whole steps); reuse the 10 ms bend smoothing.

**Where:** design 5 (Bass source), R4.14.
