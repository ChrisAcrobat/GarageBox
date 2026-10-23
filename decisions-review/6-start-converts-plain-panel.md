# Start on a mouse-opened panel makes it a gamepad menu

**Decision:** Start with no gamepad menu open asks to open the settings (R4.10). When a plain (mouse-opened) panel of that lane is already open, the panel is closed and opened again as a gamepad menu, so the cursor starts on the first field; Start never closes a panel (R2.14). In a gamepad menu Start is not given to the instrument: it goes to the menu as `navigate('start')`. On the computer keyboard (no menu navigation) the Start key still toggles the panel.

**Why:** Design 7.4 says Start turns a plain panel into a gamepad menu; reopening is the simplest way to switch the panel's mode with the existing `SettingsPanel` constructor options.

**Alternatives:** Switch the mode in place and keep the browser focus position for the cursor; ignore Start on a plain panel.

**Where:** `src/js/main.js` (`openSettingsByStart`, `menuInput`).

Milestone: Build 1 – guitar, tilt and whammy

Importance: 6 – a small detail of where the cursor starts.
