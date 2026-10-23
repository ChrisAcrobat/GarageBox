# MIDI note length: fixed estimate, tone hidden too, fade time untouched

Importance: 4 – details around the owner's "ring time does not apply to MIDI" decision.

**Decision:** (R4.7, R4.7.1, R5.4.2, design 5, 7.2)
- The trail estimate for *decaying* MIDI programs (piano, guitars, basses …) uses a fixed −60 dB after 12 s, independent of the ring time setting, so changing ring time never changes a MIDI trail.
- Not only the ring time field but also the tone field is hidden while the MIDI source is used (tone is a pluck/bass-source setting too); both keep their stored values.
- Muting a MIDI note stops it with the program's own release (as decision 4-40 / design 5 already said), not with the mute fade-out time. The owner's message listed the R4.3.1 fade among the ways to stop a sustaining MIDI note; I kept the existing design and worded R4.7 as "muted by pressing its fret again (R4.3)", with a note that MIDI ends with its program's release.

**Rationale:** the estimate needs some length for decaying programs; tying it to a setting the user cannot see would be confusing. Tone has no effect on MIDI either. Changing how MIDI mutes is a separate decision the owner did not explicitly ask for.

**Alternatives:** keep using ring time for the estimate; leave tone visible; apply the fade time to MIDI with a gain ramp per voice (needs per-voice gain nodes, tinysynth has none per note).

**Where:** requirements R4.7, R4.7.1, R5.4.2; design 5 (MIDI source, VoiceTracker), 7.2 fields.
