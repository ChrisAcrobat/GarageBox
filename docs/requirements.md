# Requirements – Music Sandbox

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
- R2.7 The chosen instrument is stored per controller (`gamepad.id`) in the browser's local storage.
- R2.8 Since the browser only exposes a controller after a button press, the app shows a prompt to press any button.
- R2.9 Each controller has its own advanced settings menu, where the user can change things like key, scale, note mapping and other instrument parameters. All settings have sensible defaults so the menu is never required to start playing.
- R2.10 A regular gamepad can be set to one of these instruments:
  - Drums (default, see section 4b).
  - Guitar: same notes and behavior as the Xplorer (section 4). Four face buttons plus one shoulder button act as the five fret buttons, and the D-pad up/down acts as the strum bar.
  - Bass: same behavior as guitar, one octave lower, with a bass sound.
- R2.11 Further General MIDI instruments can be chosen in the advanced settings (R2.9).
- R2.12 The menus (start screen, a controller's advanced settings and its device information view) can be operated with that controller while the menu is open: D-pad (on a guitar also the strum bar) up/down moves between the controls with a clearly visible highlight, left/right changes the value (right presses a button), Back closes the menu and Start opens/closes the settings as in R4.10. Each controller only operates its own menu; during normal play the controls behave as before. The computer keyboard and the mouse keep working in the menus.
- R2.13 While a guitar's (or a gamepad's in guitar/bass mode) advanced settings are open, pressing a fret plays its note at once without strumming, and releasing it stops the note, so sounds can be tried while changing them. Drums keep playing in the menu, except pads that share a button with the menu navigation.

## 3. Sound

- R3.1 All sound is produced inside the browser, without recorded audio samples. Two kinds of sound source:
  - MIDI-style instruments: General MIDI instruments (e.g. guitar, drum kit) rendered by a synthesizer running in the browser.
  - Generated sounds: custom synthesized sounds built directly with the Web Audio API.
- R3.2 If both options work well, the sound source is selectable in the app.
- R3.3 MIDI-style instruments use the vendored library [webaudio-tinysynth](https://github.com/g200kg/webaudio-tinysynth) (Apache License 2.0), which synthesizes all General MIDI instruments without samples. Its license file is kept alongside the vendored copy.
- R3.4 Generated sounds are written for this project with the Web Audio API. The guitar uses plucked-string synthesis (Karplus-Strong), which also gives the natural decay required by R4.7.
- R3.5 Default sound source per instrument: guitar uses the generated plucked-string sound; drums use the MIDI-style drum kit. The sound source can be changed per controller in the advanced settings (R2.9).

## 4. Guitar (Guitar Hero Xplorer)

- R4.1 The guitar has five colored fret buttons. A note plays when a fret button is held and the strum bar is flicked up or down.
- R4.2 When the fret button is released, the note keeps ringing.
- R4.3 When the fret button of a ringing note is pressed again, that note is muted immediately on press-down. A new note only starts when the strum bar is hit.
- R4.3.1 Muting is a short, soft fade-out rather than a hard cut. The fade time is a tunable parameter, to be adjusted by testing.
- R4.4 If the strum bar is hit twice without releasing the fret button in between, the note plays twice, possibly with a new pitch.
- R4.5 The whammy bar and the tilt (the angle the guitar is held at) affect the sound: one of them changes pitch and the other changes volume. Which one does what is not decided yet.
  - Note: on the Xplorer the tilt sensor may only report on/off rather than a gradual value. This must be verified with the real guitar before the mapping is chosen.
- R4.6 Notes on different frets ring independently. A strum only (re)triggers notes on frets that are held at that moment; other ringing notes keep sounding and are not renewed.
- R4.7 Ringing notes decay naturally and get quieter over time, like a plucked string.
- R4.8 If several fret buttons are held when the strum bar is hit, all of their notes play together as a chord.
- R4.9 By default the five fret buttons play the E minor pentatonic scale (green to orange: E, G, A, B, D). Key and scale (e.g. major/minor pentatonic, other keys) can be changed in the controller's advanced settings (R2.9).
- R4.10 Start opens the advanced settings (R2.9) for that controller.
- R4.11 Back mutes all ringing notes on that controller (using the soft fade-out from R4.3.1).
- R4.12 The Xbox (guide) button has no function, since browsers usually do not expose it.

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

## 6. Language

- R6.1 All project documentation is written in English.
- R6.2 If the app supports multiple languages, UI texts are split into one JSON file per language, plus one shared file for words that are the same in every language (if any).

## 7. Technology and deployment

- R7.1 The app is written in plain JavaScript (ES modules), HTML and CSS, loaded directly by the browser. No build step and no Node.js tooling.
- R7.2 Third-party libraries, if any, are vendored into the repository as static files (no package manager, no runtime CDN dependency).
- R7.3 Deployment to GitHub Pages is done by a GitHub Actions workflow that publishes only the files the app needs, excluding `README.md`, `docs/` and other non-app files. The workflow itself must not require Node.js-based build tooling.

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

## Open questions

Tracked in the discussion; answered questions are moved into the requirements above.
