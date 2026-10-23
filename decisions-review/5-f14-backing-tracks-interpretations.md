# F14 backing tracks: my interpretations and suggestions

Importance: 5 – future work only; to be confirmed when F14 is designed.

**Decision:**
- **Local file option:** first my suggestion, now approved by the owner, stored only as a file reference (FileSystemFileHandle); no Blob copy (owner, commits 8b19a0c and the F14 file-reference commit). See `6-f14-local-files-need-file-system-access.md`.
- **Offset sign:** positive = start later, negative = skip the beginning of the sound (one number covers both cases the owner named).
- **Volume** as a dB adjustment (−24 … +6, default 0), plus mute and remove per backing track; several backing tracks allowed.
- **Starts at recording time 0**, i.e. during the count-in, so the offset is measured on the same timeline as the recorded notes.
- **Storage:** links stored as URLs only (may break later); local files as handles in the `files` store, shared by all versions by `fileId`, deleted when no version refers to them.
- **No `<audio>` fallback** for non-CORS links: it plays silence through Web Audio and cannot be exported.
- **Latency compensation** of recorded note times against the backing track is noted as a risk/need.
- **Export:** muted backing tracks are left out of WAV/MP3; MIDI never includes them (owner).
- **Copyright note:** the user is responsible for the right to use the sound; nothing is uploaded.

**Where:** requirements F14 (F14.1–F14.5); design 13.2.
