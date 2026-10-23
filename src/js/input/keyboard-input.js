// Computer keyboard -> logical controls (design 3.2, R4c).
//
// Listens to keydown/keyup by KeyboardEvent.code (physical key position,
// R4c.7), ignores auto-repeat and only acts while enabled (R4c.2). While
// enabled it prevents the browser's default action for Space, Backspace, Alt,
// Numpad0-Numpad9 and every playing key (R4c.8, R4c.10, R4c.14), also for the
// keys that play nothing in Drums mode, so the page never scrolls or jumps.
// Keys with Ctrl or Meta held are left to the browser (shortcuts such as
// Ctrl+W cannot be blocked anyway), and so is typing into form fields such as
// the settings panel's selects.
//
// The KeyboardDevice looks like a gamepad Device to the rest of the app:
// it has `controls` and per-frame `controlEdges` with these names:
//   fret1..fret5 (Digit1..Digit5), strum (Backspace), note:<code> (musical
//   typing keys), sustain (Space), octaveUp (Shift), octaveDown (Alt),
//   pad:<code> (Numpad0..Numpad9, by code so NumLock does not matter).

import { KEY_OFFSETS, DEFAULT_NUMPAD_DRUM_MAP } from '../instruments/keys.js';

export const KEYBOARD_ID = 'computer-keyboard';
/** Lane index of the keyboard: after every gamepad (R4c, design 3.2). */
export const KEYBOARD_INDEX = 1000;

/** KeyboardEvent.code -> logical control name. */
export const KEY_CONTROLS = Object.freeze({
  Digit1: 'fret1',
  Digit2: 'fret2',
  Digit3: 'fret3',
  Digit4: 'fret4',
  Digit5: 'fret5',
  Backspace: 'strum',
  Space: 'sustain',
  ShiftLeft: 'octaveUp',
  ShiftRight: 'octaveUp',
  AltLeft: 'octaveDown',
  AltRight: 'octaveDown',
  ...Object.fromEntries(Object.keys(KEY_OFFSETS).map((code) => [code, `note:${code}`])),
  ...Object.fromEntries(Object.keys(DEFAULT_NUMPAD_DRUM_MAP).map((code) => [code, `pad:${code}`])),
});

function isFormField(target) {
  if (!target || !(target instanceof Element)) return false;
  return target.matches('input, select, textarea, [contenteditable=""], [contenteditable="true"]');
}

export class KeyboardDevice {
  constructor() {
    this.index = KEYBOARD_INDEX;
    this.id = KEYBOARD_ID;
    this.isKeyboard = true;
    this.gamepadMapping = '';
    this.detection = { type: 'keyboard', source: 'none', vidPid: null, xinput: null, knownName: null, bass: false };
    this.mapping = { name: 'keyboard', controls: {} };
    this.raw = { buttons: [], axes: [] };
    this.rawEdges = [];
    this.controlEdges = [];
    this.controls = {};
    for (const name of new Set(Object.values(KEY_CONTROLS))) this.controls[name] = { value: 0, pressed: false };
    /** Physical keys currently down. */
    this.down = new Set();
    this.pending = [];
    this.enabled = false;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onBlur = () => this.releaseAll();
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  disable() {
    if (!this.enabled) return;
    this.releaseAll();
    this.enabled = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  _key(event, isDown) {
    const name = KEY_CONTROLS[event.code];
    if (!name) return;
    if (isFormField(event.target)) return;
    if (isDown && (event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    if (isDown && event.repeat) return;
    if (isDown) this.down.add(event.code);
    else if (!this.down.delete(event.code)) return;
    this._update(name);
  }

  /** Recomputes one control from the keys that feed it and queues an edge if it changed. */
  _update(name) {
    const pressed = [...this.down].some((code) => KEY_CONTROLS[code] === name);
    const c = this.controls[name];
    if (c.pressed === pressed) return;
    c.pressed = pressed;
    c.value = pressed ? 1 : 0;
    this.pending.push({ kind: 'control', name, type: pressed ? 'pressed' : 'released', value: c.value });
  }

  /** Releases every key (window lost focus, or the instrument was turned off). */
  releaseAll() {
    const names = new Set([...this.down].map((code) => KEY_CONTROLS[code]));
    this.down.clear();
    for (const name of names) this._update(name);
  }

  /** Moves the key events since the last frame into controlEdges; call once per frame. */
  poll() {
    this.controlEdges = this.pending;
    this.pending = [];
  }
}
