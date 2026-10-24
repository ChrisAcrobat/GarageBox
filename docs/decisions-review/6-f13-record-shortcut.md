# F13 record shortcut: Ctrl+R everywhere, Cmd+R on macOS

Importance: 6 – future work; the owner chose Ctrl+R and asked me to decide the macOS key.

**Decision:** (F13.1, design 13.1)
- `Ctrl+R` on every platform, plus `Cmd+R` on macOS (where `Cmd+R` is the normal reload key, so users expect that combination). `Meta+R` is not used on Windows/Linux (Win+R is taken by the system and never reaches the page).
- `preventDefault()` stops the reload; `Ctrl+Shift+R` (hard reload) and `F5` stay with the browser, so a reload is still possible.
- Works while a form field has the focus and while the keyboard instrument is on (Ctrl/Cmd combos are never notes); only while the page has the focus. Ignores key repeat.
- Toggle: idle → open the record dialog; recording → stop; dialog open → nothing (the dialog's Start button starts).
- Red light: a red dot before the text, dimmed when idle, full red and pulsing while recording; the button reads Stop/Stoppa while recording.
- Removed the O-key clash text from F13.1 and from my interpretation file (the owner's "(o)" meant the light).

**Alternatives:** Ctrl+R only (macOS users would press Cmd+R and reload the page); Ctrl+R also starts recording from the open dialog.

**Where:** requirements F13.1, F13.6; design 13.1 (record button and shortcut, risks).
