# F13 drumsticks and metronome: sounds, defaults, tinysynth gap

Importance: 5 – future work; owner gave the structure, these are my choices.

**Decision:** (F13.3, F13.4, F13.7, F13.10; design 13.1)
- **Drumsticks** (count-in only): GM 31 Sticks on channel 10 via the existing MIDI source, velocity 110 on the first beat of a bar, 85 otherwise; they stop where bar 1 begins. (Count-in length later changed to whole bars, see 4-count-in-in-bars.md.)
- **Metronome** (from bar 1 to Stop): GM 34 Metronome Bell on the first beat of each bar, GM 33 Metronome Click on the others, velocity 100; plus a beat flash in its lane.
- **Playback defaults: both muted.** The drumsticks only cover the count-in (usually trimmed away), and a click over the music is rarely wanted when listening back; the owner hinted the drumsticks might be muted by default. Beats stay visible in their lanes; the mute state is saved with the project.
- **Routing:** their own pooled tinysynth instance on channel 10 straight to the master gain (not through a lane's volume or effect).
- **tinysynth gap (found in the vendored code):** it only plays drum notes 35–81 and silently ignores 31, 33, 34, and the vendored file must stay unmodified. So the MIDI source plays them through a substitution table (31 → 37 Side Stick, 33 → 76 Hi Wood Block, 34 → 56 Cowbell), while recordings and the MIDI export keep the real GM notes 31/33/34.
- **Export:** muted tracks are left out of WAV, MP3 and MIDI; when unmuted they are channel-10 notes in MIDI.

**Alternatives:** metronome unmuted by default; a dedicated synthesized click voice instead of MIDI drums (exact sound, but not what the owner asked); patching tinysynth (against the vendoring rule).

**Where:** requirements F13.3, F13.4, F13.7, F13.10; design 13.1 (data model, recording, export, risks).
