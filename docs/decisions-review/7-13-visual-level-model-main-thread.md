# 13. Visual level model on the main thread

**Decision:** **Visual level model (`VoiceTracker`) on the main thread**, not audio analysis.

**Why:** As design 6 says; also works without audio.

**Alternatives:** AnalyserNode per voice (impossible per voice).

**Where:** `audio-engine.js`.

Milestone: Milestone 2 – guitar sound

Importance: 7 – Internal approach; the player only sees the result.
