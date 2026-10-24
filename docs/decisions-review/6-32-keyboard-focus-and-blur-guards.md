# 32. Keyboard input guards

**Decision:** **Keys ignored while focus is in a form field or with Ctrl/Meta; all keys released on window blur; top bar controls blur themselves after a change**.

**Why:** Avoid stuck notes and stolen keystrokes.

**Alternatives:** Always capture.

**Where:** `keyboard-input.js`, `main.js`.

Milestone: Milestone 3 – more instruments

Importance: 6 – Prevents stuck notes; noticeable only in edge cases.
