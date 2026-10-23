# 59. Menu key repeat timings

**Decision:** **Key repeat 400 ms delay, then every 120 ms, for directions only; repeat state is reset whenever no menu is open.**

**Why:** Suggested values; reset avoids a direction held before Start immediately auto-repeating.

**Alternatives:** No repeat; repeat Back/Start.

**Where:** `menu-nav.js MenuInput`.

Milestone: Gamepad menu navigation

Importance: 5 – Affects how menu navigation feels.
