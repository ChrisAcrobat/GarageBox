# Numpad hits in Piano mode get their own column on the highway

**Decision:** In Piano mode the keys lane maps pitch 36–91 onto the left 94 % of the road and keeps the right 6 % as a column for numpad drum hits, divided by a line. All numpad hits use that one column, drawn as one-shot gems in the lane colour. In Drums mode the road gets one column per distinct drum sound in the letter and numpad maps, sorted by MIDI note, and every hit (letter or numpad) goes to its sound's column.

**Why:** R4c.15 wants numpad hits visible in the keyboard lane in Piano mode too. Drawing them inside the pitch range would put them at a random pitch position and mix them up with notes.

**Alternatives:** Put the numpad hits at a pitch position matching the MIDI note; give each numpad sound its own narrow column in Piano mode; place them in the drum lane colour instead of the lane colour.

**Where:** `src/js/visual/highway-view.js` (`KEYS_DRUM_COLUMN`, `keysPitchX`, `placeNote`, `drawHighway`), `src/js/instruments/keys.js` (`drumColumns`), `src/js/main.js` (`laneColumns`).

Milestone: Build 3 – keyboard drums

Importance: 5 – changes where every piano note is drawn (slightly narrower) and how drum hits look.
