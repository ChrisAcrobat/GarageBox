# F13 recording: my interpretations of the owner's description

Importance: 5 – future work only; to be confirmed when F13 is designed.

**Decision:**
- **Count-in** stays exactly 3 s as the owner said, but the clicks are placed so a beat lands exactly at its end; the first bar starts there. Alternative: a count-in of whole bars (e.g. one bar at any tempo).
- **Drumsticks and metronome:** superseded by the owner's correction (drumsticks only in the count-in, then a separate metronome); see `5-f13-drumsticks-and-metronome.md`.
- **Dialog details:** BPM default 120 (30–300), beats per bar default 4, beat unit always a quarter note, prefilled name with date and time, last choices remembered, controller-operable like other menus.
- **Stop saves at once** (first version) and opens playback, so a recording is never lost; later saves after edits create new versions.
- **Playback:** live controllers stay playable (play along) but are not recorded into the project; overdubbing is not part of F13.
- **Editing:** trim start/end; per-track volume and mute; instrument change only for melodic tracks (drums keep the kit, sounds can be reassigned); "move groups of notes" = in time only, optionally snapped to the beat grid; edits undoable until saved.
- **History:** opening an older version and saving creates a new latest version whose parent is that older one; deleting a project deletes all versions.
- **Export:** muted tracks (e.g. drumsticks, metronome) are left out of WAV/MP3/MIDI; MIDI is an approximation (no generated sounds, effects or per-string glide). MP3 may be replaced by WAV or a browser-encodable format if the encoder licence is unsuitable.
- **Design sketch** placed as a new design section 13 at the end, so existing section numbers stay valid.

**Where:** requirements F13 (F13.1–F13.10); design 13.1.
