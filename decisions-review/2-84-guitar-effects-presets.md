# 84. Guitar effects presets (R3.6)

- **Decision:** One "Effect" setting per instrument (not drums) with three presets, Clean (default), Crunch and Epic, instead of separate knobs for drive, echo and reverb. The chain sits after the instrument's volume node, so whammy volume (whammy set to volume) does not change the amount of distortion; the tilt no longer changes volume. Reverb uses a generated impulse response (decaying noise). Echo 375 ms only in Epic. Presets are level-matched to Clean.
- **Rationale:** Owner asked for an "epic electric guitar" sound. Presets are easy to choose with the guitar's menu; Clean as default keeps today's sound unchanged.
- **Alternatives:** Separate knobs per effect (more control, harder on a controller); effects before the volume node (tilt would act like a guitar's volume knob and change the distortion); power chords per fret (not part of this; could be a future idea).
- **Where:** Settings panel per device, `effects.js`, audio engine routing.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

Importance: 2 – Effects change the guitar sound a lot when chosen; owner decided the presets, details (drive, echo, reverb amounts) are mine.
