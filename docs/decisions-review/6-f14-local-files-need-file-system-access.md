# F14 local backing files: File System Access API required, no Blob fallback

Importance: 6 – owner decision; details are mine.

**Decision:** (F14.1, F14.4, F14.5; design 13.2)
- Support check `'showOpenFilePicker' in window`. Without it the Local file button shows "Your browser is not supported" / "Din webbläsare stöds inte" (key `backing.unsupported`) instead of a picker; links keep working.
- Store `files` holds only the handle plus name, type, size and last-modified, never bytes. Data model `kind: 'file'` with `fileId`.
- Permission: `queryPermission` on open, `requestPermission` from the next Play/Record gesture (it needs a user gesture). If declined: message `backing.permissionDenied` (en "No permission to read the file. Press Play and allow it to hear this track.", sv "Ingen behörighet att läsa filen. Tryck på Spela och tillåt det för att höra spåret."), the track is silent in playback, recording and export until a later request is granted.
- A moved/deleted/resized file shows 'File not found' with a re-pick option (kept from the owner's 6c75e0e/8b19a0c text).
- Risks added: Chromium-only, permission prompts per session/restart, broken references, projects not portable.

**Alternatives:** keep the Blob fallback (owner rejected); hide the button entirely in unsupported browsers (owner wants the message).

**Where:** see Decision.
