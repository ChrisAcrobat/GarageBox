# Short drum names on the on-screen keyboard

**Decision:** The keys show short, language-neutral drum names from `drumAbbr.<note>` in `src/lang/common.json` (e.g. Kick, Sn, HH, OH, PHH, Cr, Rd, Bell, Chn, Spl, Hi T, T1, T3, FT, Stick, Clap, Tamb, Cow; "2" for the second variant). The settings panel uses the full translated names already in use for the drum controller.

**Why:** Full names do not fit on a key. The abbreviations are common drummer jargon in both English and Swedish, so one shared set avoids two translations.

**Alternatives:** Translated abbreviations per language (`en.json`/`sv.json`); icons; the MIDI note number.

**Where:** `src/lang/common.json`, `src/js/visual/keyboard-view.js`.

Milestone: Build 3 – keyboard drums

Importance: 7 – visible labels, easy to change.
