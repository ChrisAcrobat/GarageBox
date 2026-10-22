# Requirements – GarageBox - Music Sandbox

Status: draft, under discussion.

## 1. Platform

- R1.1 The app is a website published on GitHub Pages (static files, no server).
- R1.2 The primary target environment is Chrome on Linux. Other browsers and operating systems should work where possible, but are tested second.

## 2. Controllers

- R2.1 The page detects which game controllers are connected.
- R2.2 If the controller is a regular gamepad, the user can choose which instrument it controls. The default is drums.
- R2.3 If the controller is a guitar controller, guitar is preselected.
- R2.4 Each connected controller becomes its own instrument.
- R2.5 The controller type is determined primarily from `gamepad.id`:
  - The XInput type in the name (Chrome/Edge on Windows), e.g. `GUITAR`, `GUITAR_ALTERNATE`, `GUITAR_BASS`, `DRUM_KIT`.
  - Vendor and product ID (Chrome: `Vendor: 1430 Product: 4748`, Firefox: `1430-4748-...`) matched against a list of known guitars and drum kits, taken from the Linux `xpad` driver's device table.
  - Keywords in the name, e.g. `guitar`, `x-plorer`, `drum`.
- R2.6 The user can always change the instrument manually, regardless of what the app detected.
- R2.7 All per-device settings (instrument, sound and every other per-device choice, plus any play state that changes how the device sounds, such as the locked range offset of R4.5.6) are stored per controller in the browser's local storage, so a device sounds the same after reloading the page (F5).
  - R2.7.1 Settings are always keyed by detected controller type and connection slot, e.g. "guitar, controller 1" (controller number as in R5.3.1). Different types on the same slot keep separate settings, so a gamepad and a guitar can both be used on slot 1 (not at the same time) without overwriting each other's settings. The detected type (R2.5) is used, not a manually chosen instrument (R2.6), so changing the instrument does not move the settings to another key.
- R2.8 Since the browser only exposes a controller after a button press, the app shows a prompt to press any button.
- R2.9 Each controller has its own advanced settings menu, where the user can change things like key, scale, note mapping and other instrument parameters. All settings have sensible defaults so the menu is never required to start playing.
- R2.9.1 Settings that are a number (for example mute fade-out, ring time, tilt smoothing, bend range) are number fields, not drop-down lists: the value can be typed in freely within the field's allowed range, and stepped up and down with the controller (R2.12). A typed value outside the range is set to the nearest allowed value; an empty or invalid entry goes back to the previous value. Settings that are a choice between named options (for example tone, octave, key, scale) stay drop-down lists.
- R2.10 A regular gamepad can be set to one of these instruments:
  - Drums (default, see section 4b).
  - Guitar: same notes and behavior as the Xplorer (section 4). Four face buttons plus one shoulder button act as the five fret buttons, and the D-pad up/down acts as the strum bar.
  - Bass: same behavior as guitar, one octave lower, with a bass sound.
- R2.11 Further General MIDI instruments can be chosen in the advanced settings (R2.9).
- R2.12 The menus (start screen, a controller's advanced settings and its device information view) can be operated with that controller while the menu is open: D-pad up/down moves between the controls with a clearly visible highlight, left/right changes the value of the highlighted control, Start activates the highlighted control (presses a button, toggles a checkbox) and Back closes the menu (from the device information view, Back goes back to the settings). Each action has exactly one button: Start does not close a menu, left/right do not press buttons, and a Back press that closes a menu never also turns tilt on or off (R4.11.1). On a guitar controller (e.g. the Xplorer) the directions are turned 90 degrees clockwise, because that matches how the guitar is held: right moves down to the next control, left moves up to the previous one, and up/down (the strum bar, which is the same button as D-pad up/down) change the value, up forwards and down backwards. This applies to every menu operated by a guitar controller, also when it is set to play another instrument, but not to a regular gamepad in guitar/bass mode. Each controller only operates its own menu; during normal play the controls behave as before. The computer keyboard and the mouse keep working in the menus.
- R2.13 While a guitar's (or a gamepad's in guitar/bass mode) advanced settings are open as a controller menu (R2.14), pressing a fret plays its note at once without strumming, and releasing it stops the note, so sounds can be tried while changing them. Drums keep playing in the menu, except pads that share a button with the menu navigation.
- R2.14 R2.12 and R2.13 apply only when the settings were opened with Start on the controller. Settings opened with the mouse (or the keyboard) do not change how the controller plays: it keeps strumming, muting with the frets, turning tilt on and off with Back (R4.11) and playing all pads as usual, and setting changes still take effect immediately. Pressing Start on the controller while such settings are open turns them into a controller menu.

## 3. Sound

- R3.1 All sound is produced inside the browser, without recorded audio samples. Two kinds of sound source:
  - MIDI-style instruments: General MIDI instruments (e.g. guitar, drum kit) rendered by a synthesizer running in the browser.
  - Generated sounds: custom synthesized sounds built directly with the Web Audio API.
- R3.2 If both options work well, the sound source is selectable in the app.
- R3.3 MIDI-style instruments use the vendored library [webaudio-tinysynth](https://github.com/g200kg/webaudio-tinysynth) (Apache License 2.0), which synthesizes all General MIDI instruments without samples. Its license file is kept alongside the vendored copy.
- R3.4 Generated sounds are written for this project with the Web Audio API. The guitar uses plucked-string synthesis (Karplus-Strong), which also gives the natural decay required by R4.7.
- R3.4.1 The bass has its own generated bass sound, not the guitar's plucked string, so it sounds round and full like an electric bass played with the fingers: a soft thump when the note starts, a steady low tone, and a natural decay (R4.7). Mute fade-out (R4.3.1), the whammy (R4.5), tilt range shifting (R4.5.2 – R4.5.7), ring time and tone work the same way as for the guitar. The plucked string and the MIDI-style bass remain available as other sound sources for the bass.
- R3.5 Default sound source per instrument: guitar uses the generated plucked-string sound; bass uses the generated bass sound (R3.4.1); drums use the MIDI-style drum kit. The sound source can be changed per controller in the advanced settings (R2.9).
- R3.6 Guitar effects: every instrument except the drums can be given an effect sound in the controller's advanced settings (R2.9), so it can sound like an electric guitar through an amplifier. Choices: Clean (default, no effects, the sound as it is today), Crunch (light distortion and a small room) and Epic (heavy distortion, an echo and a large reverb, like a rock guitar on a big stage). The effects work with both sound sources and, like all other sound, are generated in the browser without recordings (R3.1). Choosing an effect must not make the instrument clearly louder than Clean.

## 4. Guitar (Guitar Hero Xplorer)

- R4.1 The guitar has five colored fret buttons. A note plays when a fret button is held and the strum bar is flicked up or down.
- R4.2 When the fret button is released, the note keeps ringing.
- R4.3 When the fret button of a ringing note is pressed again, that note is muted immediately on press-down. A new note only starts when the strum bar is hit.
- R4.3.1 Muting is a soft fade-out rather than a hard cut. The fade time is a setting (R2.9.1) with a default of 1000 ms, and it can be set both shorter and longer.
- R4.4 If the strum bar is hit twice without releasing the fret button in between, the note plays twice, possibly with a new pitch.
- R4.5 The whammy bar bends the pitch down: pressed all the way it lowers all ringing notes of the controller by a whole tone (−2 semitones), like a real whammy bar, which slackens the strings; pressed halfway it lowers them by half as much, and released the notes are back at their normal pitch. How far the whammy bends at full press (the bend range) is a number setting (R2.9.1). In the advanced settings the whammy can instead be set to change the volume or to do nothing. The tilt (the angle the guitar is held at, which is gradual on the Xplorer, see design 9.1) never changes the volume and never bends the pitch: it moves the guitar's playable range (R4.5.2 – R4.5.7). There is no vibrato option and no setting that gives the tilt a sound effect.
- R4.5.1 The tilt value is smoothed before it is used, so small shakes of the hand do not make the playable range jump (or a glide wobble, R4.14). The amount of smoothing can be changed in the controller's advanced settings (R2.9), including turning it off; the setting is shown on every controller with a tilt sensor. The device information view (debug view) keeps showing the raw value.
- R4.5.2 Tilt range shifting is turned on and off per controller with Back (R4.11). It is off when a controller connects and after the page is reloaded. Turning it on or off makes no sound of its own and shows no message; the simple view shows whether it is on (R5.6).
- R4.5.3 While tilt is on, tilting the neck moves all five fret buttons through the notes of the current key and scale. One *step* is one note of the scale. Tilting by 0.1 of the tilt range (the tilt value runs from 0 to 1) away from the angle the guitar was held at when tilt was turned on moves the frets by one step: neck up = higher notes, neck down = lower notes. For example, with E minor pentatonic (frets E3 G3 A3 B3 D4), two steps up the frets play A3 B3 D4 E4 G4 and one step down D3 E3 G3 A3 B3. With a scale of more than five notes the frets walk through all its notes (C major, two steps up from C3: E3 F3 G3 A3 B3). The sound moves in whole steps (unless tilt glide is on, R4.14). A step only changes once the tilt has moved a little past halfway to the next step (a small dead zone of 0.2 step, about 0.02 of the tilt range), so the notes do not flicker between two steps while the neck is held near the boundary.
- R4.5.4 Ringing notes keep their pitch when the range moves (unless tilt glide is on, R4.14); only notes started afterwards, strummed or tapped (R2.13), use the new range.
- R4.5.5 The range moves at most three octaves of the scale up or down from the normal range (15 steps for a five-note scale, 18 for the six-note blues scale, 21 for a seven-note scale); tilting further keeps it at the limit. The lowest and highest MIDI notes (0 and 127) are never passed.
- R4.5.6 Turning tilt off with Back locks the range where it is: the whole step the sound is using at that moment becomes the controller's new starting range (its *range offset*, a whole number of steps, 0 = the normal range). While tilt is off the frets keep playing that range at any angle. The range offset is saved with the controller's per-device settings (R2.7), so it survives a reload, and it stays the same number of steps when the key or scale is changed (so the actual notes follow the new scale). Turning tilt on again starts from the locked range and measures the tilt from the angle the guitar is held at that moment. The panel's "Reset to defaults" button (R2.9) sets the range offset back to 0; if tilt is on at that moment it stays on and is measured from the current angle again, so the frets are exactly at the normal range.
- R4.5.7 A controller without a tilt sensor (e.g. a regular gamepad in guitar or bass mode, R2.10) can still turn tilt on and off with Back, but its range never moves; it stays at its saved range offset (normally 0).
- R4.6 Notes on different frets ring independently. A strum only (re)triggers notes on frets that are held at that moment; other ringing notes keep sounding and are not renewed.
- R4.7 Ringing notes decay naturally and get quieter over time, like a plucked string.
- R4.8 If several fret buttons are held when the strum bar is hit, all of their notes play together as a chord.
- R4.9 By default the five fret buttons play the E minor pentatonic scale (green to orange: E, G, A, B, D). Key and scale (e.g. major/minor pentatonic, other keys) can be changed in the controller's advanced settings (R2.9).
- R4.10 Start opens the advanced settings (R2.9) for that controller. While they are open as a controller menu, Start activates the highlighted control and Back closes them (R2.12).
- R4.11 During play, Back turns tilt range shifting (R4.5.2) on or off for that controller. It acts when Back is released, not when it is pressed, and only if Back was held for less than 5 seconds (a longer hold resets the controller instead, R4.11.2). Back does not mute: ringing notes are muted by pressing their fret again (R4.3) or decay by themselves (R4.7). This applies to every controller playing guitar or bass, including a regular gamepad in guitar or bass mode (R4.5.7) and settings opened with the mouse (R2.14). On a lane playing drums a short press of Back does nothing.
- R4.11.1 While a controller's menu is open as a controller menu (R2.12, R2.14), and while the start screen is shown, Back only closes the menu. It never turns tilt on or off and never resets the controller: a Back press that was already going on when the menu opened is forgotten (it neither toggles on release nor counts toward the 5-second hold of R4.11.2), and the release of a Back press that closed a menu does nothing.
- R4.11.2 Holding Back for 5 seconds during play resets that controller's per-device settings (R2.7) to the defaults. The reset happens as soon as the 5 seconds are reached, while Back is still held: ringing notes of that controller fade out (R4.3.1), tilt range shifting is turned off, the range offset goes back to 0 (R4.5.6), and a short message "Settings reset" is shown in that controller's lane. Releasing Back afterwards does nothing (tilt is not toggled). The reset restores every per-device default of that controller, the same as the *Reset to defaults* button in its advanced settings, including the instrument it plays (a regular gamepad goes back to drums, a manually chosen instrument goes back to the one detected for the controller, R2.5), the sound, the key and scale and all other per-device settings. Only that controller is affected; other controllers and the global settings (language, visual style, master volume and so on) stay as they are. This works on every controller with a Back button, whatever it plays, including drums, but not while a menu owns Back (R4.11.1). The *Reset to defaults* button in the advanced settings also clears the range offset, but leaves tilt on or off as it was.
- R4.12 The Xbox (guide) button has no function, since browsers usually do not expose it.
- R4.13 The pitch range (octave) of the fret buttons can be changed in the controller's advanced settings (R2.9): Low (one octave down), Middle (default) and High (one octave up). This applies to the guitar and the bass, also in the gamepad guitar/bass mode (R2.10); Middle keeps the default ranges (guitar from E3, bass from E2).

## 4b. Drums (regular gamepad)

- R4b.1 Default mapping on a standard-layout gamepad:
  - The four right-side face buttons play kick drum, snare, hi-hat and tom.
  - The shoulder buttons play cymbals (e.g. crash and ride).
  - The analog triggers play drums whose hit strength (velocity) depends on how far the trigger is pressed.
- R4b.2 The exact assignment of sounds to buttons can be changed in the controller's advanced settings (R2.9).

## 4c. Computer keyboard

- R4c.1 The computer keyboard can act as an extra instrument, so the app can be tried and tested without a game controller.
- R4c.2 The keyboard instrument is hidden by default and can be turned on in the settings. When hidden, key presses do not play notes.
- R4c.3 Guitar emulation: keys `1`–`5` act as the five fret buttons (green to orange) and `Backspace` acts as the strum bar, with the same behavior as the Xplorer (section 4).
- R4c.4 Melodic keys use the "musical typing" layout common in music software, based on a piano keyboard:
  - The home row (`A S D F G H J K L`) plays the natural notes (white piano keys), e.g. C D E F G A B C D.
  - The row above (`W E T Y U O P`) plays the sharps/flats (black piano keys), placed between the home-row keys they sit between, e.g. `W` = C#, `E` = D#.
  - The bottom row (`Z X C V B N M`) plays the same natural notes as the home row, one octave lower.
- R4c.5 When the keyboard instrument is visible, an on-screen keyboard shows the note name on each key that plays a note.
- R4c.6 Like all instruments, a key lights up on screen while it is pressed.
- R4c.7 Key positions are based on physical key location (`KeyboardEvent.code`), so the layout works the same on Swedish and other keyboard layouts.
- R4c.8 Momentary octave shift, combined with R4c.4 (no setting needed):
  - While `Shift` is held, all melodic keys play one octave higher.
  - While `Alt` is held, all melodic keys play one octave lower.
  - The shift applies to notes started while the modifier is held; ringing notes keep their pitch when it is released.
  - `Ctrl` is deliberately not used, since browser shortcuts such as `Ctrl+W` (close tab) cannot be blocked by the page.
  - The app prevents the browser's default action for `Alt` (e.g. focusing the menu) while the keyboard instrument is active.
- R4c.9 Melodic keys behave like a piano: the note sounds while the key is held and stops (with a short soft release) when the key is released.
- R4c.10 `Space` acts as a sustain pedal: while it is held, released notes keep ringing and decay naturally; when it is released, all notes whose keys are no longer held stop. The app prevents the browser's default action for `Space` (page scroll) while the keyboard instrument is active.
- R4c.11 The keyboard instrument's default sound is Acoustic Grand Piano from the MIDI-style instruments (R3.3). The sound can be changed in its advanced settings like any other instrument (R2.9).

## 5. Visuals

- R5.1 The screen shows which notes are being played.
- R5.2 The visual style is selectable:
  - Highway view: each played note appears at the player's end of a Guitar Hero-style highway and travels away from the player into the distance, the opposite direction of Guitar Hero (notes are not incoming targets, they are a trail of what was played).
  - Simple view: each controller has its own panel where the buttons light up and note names are shown while they play.
- R5.3 Each controller (instrument) has its own visual lane or panel. With several controllers connected, the lanes are shown side by side, like multiplayer Guitar Hero.
- R5.3.1 Above each lane the app shows the controller number (e.g. "1", "2", matching `gamepad.index` + 1) and the lane has its own color.
- R5.4 In the highway view, a ringing note is drawn as a long trail (sustain line) from its start for as long as it sounds. The trail fades in step with the note's volume (decay, fade-out, mute) and ends when the note stops.
  - R5.4.1 Where note marks or trails overlap in the highway view, newer notes are drawn on top of older ones.
  - R5.4.2 A trail lasts exactly as long as its note can be heard, for every sound. A sound that keeps playing until it is stopped (e.g. a MIDI organ held down) keeps its trail until the sound has gone silent; the trail never ends earlier because of an assumed decay time.
  - R5.4.3 When a trail ends, its near end glides away at the same speed as the rest of the highway (note marks, trails, cross lines); it never jumps or jerks.
  - R5.4.4 The far end of the highway has no visible edge or border: the road looks as if it continues past the edge of the screen.
  - R5.4.5 Pitch bend from the whammy bar is visible on the trail, so the part of the trail played while bending looks different from the rest.
- R5.5 Star power: when a guitar with a whammy bar and a tilt sensor (e.g. the Xplorer) is held with the neck pointing up and the whammy bar is pressed all the way at the same time, star power starts on that controller's lane. Star power is only a visual effect: confetti rains over the lane and the lane's light changes, in both visual styles. Star power lasts as long as the neck is held up (the whammy bar may be released). When the neck is lowered, a countdown of about 8 seconds starts, and star power ends when it runs out. If the neck is raised again before that, star power continues and the countdown starts over the next time the neck is lowered. The countdown is not shown on screen. Star power adds no sound change of its own: the whammy bar keeps doing what it is set to do (R4.5) and, if tilt range shifting is on, raising the neck keeps moving the range (R4.5.3), exactly as without star power. Star power only uses the neck-up position (the tilt counted as pressed, design 3.1), not tilt range shifting: it starts and lasts the same whether tilt is on or off (R4.5.2), and whatever the whammy is set to do. After star power has ended, it starts again only the same way it started the first time (neck up and whammy bar fully pressed). It can be turned off in the controller's advanced settings (R2.9). A more complete star power design is separate future work (F11).
- R5.6 In the simple view, the tilt control of a guitar lane shows whether tilt range shifting (R4.5.2) is on or off and the current range offset in steps, e.g. "Tilt: on · +2 steps" or "Tilt: off · 0 steps". While tilt is off the control is shown dimmed and does not light up or fill when the guitar is tilted.
- R5.7 The note names under the five fret buttons (the *note strip*) follow the playable range (R4.5.3) in both visual styles, on guitar and bass lanes and on the strip of the computer keyboard's guitar keys (R4c.3). While tilt range shifting is on, the names slide smoothly sideways with the tilt, also between whole steps: tilting the neck up moves them to the left, so the next higher scale note slides in from the right towards the orange fret while the lowest name slides out on the left, and tilting down does the opposite. Names fade out as they move past the outer frets. The strip shows where the range is heading before the sound changes; when tilt is turned off, the strip settles at once on the locked whole step (R4.5.6). If the system asks for reduced motion (`prefers-reduced-motion`), the names jump one whole step at a time (the step the sound uses) instead of sliding. There is no separate range badge and no message when tilt is turned on or off.
  - R5.7.1 When tilt glide (R4.14) is off, the strip follows the tilt directly while the sound waits for the dead zone of R4.5.3, so near a step boundary the strip can be up to about 0.7 of a step ahead of the notes the frets play. This is accepted: the strip stays smooth, and as soon as the sound changes step, or tilt is turned off, both agree again. With tilt glide on, strip and sound always use the same value.
- R5.8 Orientation bars: short bars in the yellow fret color under some names of the note strip show where the middle of the key is. The *reference note* is the note of the middle (yellow) fret in the normal range (range offset 0) for the current key, scale and octave setting, e.g. A3 with the default E minor pentatonic. Every name in the strip with the same note letter as the reference note (the same pitch class) gets bars: one bar for the reference note itself, and one more bar for each octave away from it (A3 = 1 bar, A2 and A4 = 2 bars, A1 and A5 = 3 bars). Other names get none. The bars move and fade together with their name, the reference note does not move with the tilt or the locked range, and it is worked out again when the key, scale or octave setting changes. The strip always keeps room for the bars, so nothing below it moves while the names slide.

## 5b. Name

- R5b.1 The app is called **GarageBox - Music Sandbox** (short form "GarageBox"). This name is used in the page title, the app title (`app.title` in `lang/common.json`) and the titles of the test pages. The tagline "Your controllers are the band." may be shown on the start screen.
- R5b.2 The README states that the project is inspired by Apple's GarageBand and is not affiliated with Apple.

## 6. Language

- R6.1 All project documentation is written in English.
- R6.2 If the app supports multiple languages, UI texts are split into one JSON file per language, plus one shared file for words that are the same in every language (if any).
- R6.3 Note names: there are two sets of note names, the international names (C C# D D# E F F# G G# A A# B) and the names used in the current UI language. Each language file defines its own set. If the language's set is the same as the international one (as in English), no setting is shown and the international names are used. If they differ (as in Swedish, where B is called H), a global setting "Note names" lets the user choose between the two, with the international names as the default. The choice applies everywhere note names are shown (lanes, highway, on-screen keyboard, settings) and is saved like the other settings.

## 7. Technology and deployment

- R7.1 The app is written in plain JavaScript (ES modules), HTML and CSS, loaded directly by the browser. No build step and no Node.js tooling.
- R7.2 Third-party libraries, if any, are vendored into the repository as static files (no package manager, no runtime CDN dependency).
- R7.3 Deployment to GitHub Pages is done by a GitHub Actions workflow that publishes only the files the app needs. All app files live in a `src/` folder and the workflow publishes exactly that folder; `README.md`, `docs/`, `tests/` and other non-app files stay outside `src/`. The workflow itself must not require Node.js-based build tooling.

## Future work (out of scope for now)

- F1 Optional output to a real MIDI device or music program (via Web MIDI) when one is available, as an alternative sound source.
- F2 Recorded (sampled) instrument sounds, e.g. from a freely licensed sound bank, as an additional sound source.
- F3 User-editable names for controllers/players, shown above each lane instead of or next to the controller number.
- F4 A play-along mode in the style of Guitar Hero, where the highway scrolls towards the player and the player tries to hit predefined notes in time.
  - F4.1 The mode ships with predefined songs, e.g. "Twinkle, Twinkle, Little Star".
  - F4.2 Each song is its own JSON file. Fields include at least the song name and note charts per instrument.
  - F4.3 An instrument can have several charts in the same song, e.g. "Guitar Lead" and "Guitar Rhythm".
  - F4.4 Song names support several languages. Name lookup order: the user's current UI language, then English, then the first name in the list.
- F5 If feasible, the user can provide a link to an audio file or a video (e.g. YouTube); the app analyses the audio and generates a note chart for F4 that the player then tries to follow.
- F6 Microphone input as an instrument source. The two parts below are separate features and do not need to be built at the same time.
  - F6.1 Singing: a microphone used for vocals, e.g. as a vocal lane or for singing along.
  - F6.2 Instrument recording: a microphone used to pick up one or more real instruments.
  - F6.3 If the browser and hardware allow it, support several microphones at once (e.g. one per player or instrument).
- F7 Pop-out settings page: a controller's advanced settings (R2.9) can be opened in a separate browser window (e.g. with `window.open` of a settings page that talks to the main page via `BroadcastChannel` or `postMessage`), so a mouse user can adjust settings on another screen while playing. Changes apply live in the main window.
- F8 Show the tagline "Your controllers are the band." on the start screen, e.g. under the heading, as a translated UI string.
- F9 Tilt glides between keys: tilting the guitar up or down moves the fret notes smoothly up or down through the keys (instead of only changing volume or bending the pitch), and the fret buttons could then cover more or fewer than five scale notes.
- F10 A more advanced plucked-string sound (R3): better tuning of high notes (e.g. allpass interpolation instead of linear interpolation in the delay line) and a choice of where the string is plucked (pick position, which changes the tone from round to twangy).
- F11 A fuller star power design (R5.5): e.g. how it is earned, longer or stronger effects, effects that follow the music.
- F12 Named presets: the user can save a controller's settings under a name and open a saved preset later. These named presets are separate from the unnamed settings that are saved automatically on every change (R2.7) and restored on reload. Resetting a controller's settings (by holding Back for 5 seconds, R4.11.2, or with *Reset to defaults*) restores the most recently opened named preset, or the defaults if none has been opened; it replaces the unnamed saved settings and never changes a named preset.

## Open questions

Tracked in the discussion; answered questions are moved into the requirements above.

- Q1 Twist/rotation: can the guitar's rotation (other than the tilt in R4.5) be read on any controller, and should it be smoothed like the tilt (R4.5.1)? To be tried out with the hardware later.
