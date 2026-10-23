# Strum hold: how it is built and its edge cases

Importance: 3 – the owner decided the behaviour; these are my choices for the details.

**Decision:** (R4.7.2, design 4.1, 4.2, 5, 7.4, 9.2)
- Events: `noteOn` gets `hold: true` for every strummed voice and a new `holdEnd` event per voice starts the decay. Sent for every source; the MIDI source ignores both (owner's default kept: holding has no extra effect for MIDI, a sustaining program already sustains until muted).
- The hold lasts while *any* strum control is down (`strumsDown` set). The other strum direction pressed while one is held restrums as usual and the hold ends only when both are up. Muted, restrummed or reset voices leave the held set without a `holdEnd`.
- Pluck worklet: "loop gain 1 + make-up gain" rather than a pure output freeze: loop gain 1 alone still lets high notes fade through the low-pass, so a per-voice make-up gain (reference = RMS of the first 50 ms, capped at ×4 / +12 dB) keeps the level. On release the make-up freezes and the normal ring-time loop gain applies, so the decay starts from the current level. I did not raise the loop gain above 1 to compensate the low-pass, because that would make DC and rounding errors grow in the loop.
- Bass source: attack only while held, then `setTargetAtTime` decay from the release (never before the 5 ms attack ends).
- Menus: `releaseStrumHold(now)` is called in every frame a controller menu owns the lane's directions (next to `cancelBackHold()`), so held notes start decaying when a menu opens. A mouse-opened panel does not change playing (R2.14), so the hold works there.
- Tap-to-play notes are never held; the keyboard's guitar keys hold with Backspace like a strum bar.

**Rationale:** smallest change that keeps a quick strum identical to today (hold + holdEnd in the same frame) and keeps the trail estimate in step with the sound.

**Alternatives:** only the strum direction that started the notes counts; a per-instrument `sustain` on/off event instead of per-voice `holdEnd`; pluck: freeze the delay line (sounds static/buzzy) or loop gain > 1 (unstable); MIDI: send CC64 sustain (would also hold muted notes, conflicting with R4.3).

**Where:** requirements R4.7.2; design 4.1 events, 4.2 strum hold, 5 engine routing, pluck and bass sources, VoiceTracker, 7.4, 9.2 tests.
