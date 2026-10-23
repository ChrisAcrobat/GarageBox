// Keys: the computer keyboard as a piano with sustain pedal (design 4.4, R4c).
//
// Key positions use KeyboardEvent.code (R4c.7) with the "musical typing"
// layout (R4c.4): the home row plays the white keys from C4, the row above
// the black keys between them, the bottom row the white keys one octave lower.
// Shift / Alt held while a key is pressed shift that note one octave up / down
// (R4c.8). A key sounds while held and stops with a short release when let go
// (R4c.9), unless Space (sustain pedal) is held; then it keeps ringing and is
// stopped when the pedal comes up, if its key is no longer held (R4c.10).
// Keys 1-5 and Backspace go to an internal Guitar (R4c.3); its events carry
// `part: 'guitar'` so they can be routed to the guitar sound.
//
// Instrument choice (R4c.12): `keysMode` 'piano' (all of the above) or
// 'drums' (R4c.13): the musical typing keys then play one-shot MIDI drum hits
// from `keysDrumMap`, and octave shift, sustain and the guitar keys are off.
// The numpad (`pad:<code>`) is a small drum kit in both modes (R4c.14), from
// `numpadDrumMap`. Drum hits carry `part: 'drums'` (the keyboard's drum
// channel) and are never stopped: releasing the key sends nothing.

import { Instrument, newVoiceId } from './instrument.js';
import { Guitar } from './guitar.js';
import { DIGITAL_VELOCITY, DRUM_NOTES } from './drums.js';

/** Semitones from the base note (C4 = 60 by default) per KeyboardEvent.code. */
export const KEY_OFFSETS = Object.freeze({
  // Home row: white keys C4..D5
  KeyA: 0, KeyS: 2, KeyD: 4, KeyF: 5, KeyG: 7, KeyH: 9, KeyJ: 11, KeyK: 12, KeyL: 14,
  // Row above: black keys, between the home-row keys they sit between
  KeyW: 1, KeyE: 3, KeyT: 6, KeyY: 8, KeyU: 10, KeyO: 13, KeyP: 15,
  // Bottom row: white keys C3..B3
  KeyZ: -12, KeyX: -10, KeyC: -8, KeyV: -7, KeyB: -5, KeyN: -3, KeyM: -1,
});

/** Instrument choices of the keyboard (R4c.12); the first is the default. */
export const KEYS_MODES = Object.freeze(['piano', 'drums']);

/**
 * Drums mode letter keys -> GM drum note (R4c.13, design 4.4): the home row
 * is the main kit, the row above the cymbals, the bottom row extra sounds.
 */
export const DEFAULT_KEYS_DRUM_MAP = Object.freeze({
  // Home row
  KeyA: 36, // kick
  KeyS: 38, // snare
  KeyD: 42, // closed hi-hat
  KeyF: 46, // open hi-hat
  KeyG: 44, // pedal hi-hat
  KeyH: 50, // high tom
  KeyJ: 48, // hi-mid tom
  KeyK: 45, // low tom
  KeyL: 41, // low floor tom
  // Row above
  KeyW: 49, // crash
  KeyE: 51, // ride
  KeyT: 53, // ride bell
  KeyY: 52, // Chinese cymbal
  KeyU: 55, // splash
  KeyO: 57, // crash 2
  KeyP: 59, // ride 2
  // Bottom row
  KeyZ: 36, // second kick (double-kick patterns)
  KeyX: 37, // side stick
  KeyC: 39, // hand clap
  KeyV: 40, // electric snare
  KeyB: 43, // high floor tom
  KeyN: 54, // tambourine
  KeyM: 56, // cowbell
});

/** Numpad kit (R4c.14), laid out like a kit seen from above; in both modes. */
export const DEFAULT_NUMPAD_DRUM_MAP = Object.freeze({
  Numpad7: 49, // crash
  Numpad8: 46, // open hi-hat
  Numpad9: 51, // ride
  Numpad4: 50, // high tom
  Numpad5: 38, // snare
  Numpad6: 45, // low tom
  Numpad1: 42, // closed hi-hat
  Numpad2: 36, // kick
  Numpad3: 41, // low floor tom
  Numpad0: 36, // kick
});

/** 'piano' or 'drums'; anything else is 'piano' (R4c.12). */
export function resolveKeysMode(mode) {
  return KEYS_MODES.includes(mode) ? mode : KEYS_MODES[0];
}

/**
 * A full drum map from a stored one: every key of `defaults`, with the stored
 * entry where it is 0 (none) or a drum sound of the list (design 4.4).
 */
export function resolveDrumMap(defaults, stored) {
  const map = { ...defaults };
  if (stored && typeof stored === 'object') {
    for (const code of Object.keys(defaults)) {
      if (DRUM_NOTES.includes(stored[code])) map[code] = stored[code];
    }
  }
  return map;
}

export const DEFAULT_KEYS_OPTIONS = Object.freeze({
  base: 60,
  velocity: 100,
  release: 0.15, // seconds, short soft release (R4c.9)
  guitar: {},
  keysMode: 'piano',
  keysDrumMap: DEFAULT_KEYS_DRUM_MAP,
  numpadDrumMap: DEFAULT_NUMPAD_DRUM_MAP,
});

const GUITAR_CONTROLS = new Set(['fret1', 'fret2', 'fret3', 'fret4', 'fret5', 'strum']);

export class Keys extends Instrument {
  constructor(options = {}) {
    super();
    /** code -> { voiceId, midi, held, sustained } for keys whose note rings */
    this.notes = new Map();
    this.octaveUp = false;
    this.octaveDown = false;
    this.sustain = false;
    /** Events to send with the next handle() (the noteOffs of a mode change). */
    this.pending = [];
    this.guitar = new Guitar(options.guitar || {});
    this.configure(options);
  }

  configure(options = {}) {
    const oldMode = this.options?.keysMode;
    this.options = { ...DEFAULT_KEYS_OPTIONS, ...this.options, ...options };
    this.options.keysMode = resolveKeysMode(this.options.keysMode);
    this.keysDrumMap = resolveDrumMap(DEFAULT_KEYS_DRUM_MAP, this.options.keysDrumMap);
    this.numpadDrumMap = resolveDrumMap(DEFAULT_NUMPAD_DRUM_MAP, this.options.numpadDrumMap);
    if (options.guitar) this.guitar.configure(options.guitar);
    // A mode change stops every ringing piano and guitar-key note (R4c.12).
    if (oldMode && oldMode !== this.options.keysMode) {
      this.pending.push(...this.stopAll());
      this.out = [];
    }
  }

  get drumsMode() {
    return this.options.keysMode === 'drums';
  }

  /**
   * The drum sounds of the lane's columns in Drums mode (design 6): every
   * distinct GM note of both maps, in GM note order.
   */
  drumColumns() {
    const notes = [...Object.values(this.keysDrumMap), ...Object.values(this.numpadDrumMap)].filter((n) => n > 0);
    return [...new Set(notes)].sort((a, b) => a - b);
  }

  /** GM drum note a letter key plays in Drums mode (0 = none, null = not a playing key). */
  drumFor(code) {
    return code in this.keysDrumMap ? this.keysDrumMap[code] : null;
  }

  /** MIDI note a key would play right now (with the current octave shift), or null. */
  noteFor(code) {
    if (!(code in KEY_OFFSETS)) return null;
    return this.options.base + KEY_OFFSETS[code] + this.octaveShift() * 12;
  }

  octaveShift() {
    return (this.octaveUp ? 1 : 0) - (this.octaveDown ? 1 : 0);
  }

  process(edges, controls, time) {
    for (const event of this.pending) this.emit({ ...event, time });
    this.pending = [];
    // Modifiers first, so a note pressed together with Shift/Alt is shifted.
    for (const e of edges) {
      if (e.name === 'octaveUp') this.octaveUp = e.type === 'pressed';
      else if (e.name === 'octaveDown') this.octaveDown = e.type === 'pressed';
    }
    // The numpad kit plays in both modes (R4c.14).
    for (const e of edges) {
      if (e.name.startsWith('pad:') && e.type === 'pressed') this._drumHit(this.numpadDrumMap[e.name.slice(4)], time);
    }
    if (this.drumsMode) {
      // Drums mode (R4c.13): only letter key presses; Shift, Alt, Space,
      // 1-5 and Backspace do nothing, and a release sends nothing.
      for (const e of edges) {
        if (e.name.startsWith('note:') && e.type === 'pressed') this._drumHit(this.drumFor(e.name.slice(5)), time);
      }
      return;
    }
    for (const e of edges) {
      if (e.name.startsWith('note:')) {
        const code = e.name.slice(5);
        if (e.type === 'pressed') this._keyDown(code, time);
        else if (e.type === 'released') this._keyUp(code, time);
      } else if (e.name === 'sustain') {
        if (e.type === 'pressed') this.sustain = true;
        else if (e.type === 'released') this._pedalUp(time);
      }
    }
    // Guitar emulation on 1-5 and Backspace.
    const guitarEdges = edges.filter((e) => GUITAR_CONTROLS.has(e.name));
    for (const event of this.guitar.handle(guitarEdges, controls, time)) {
      this.emit({ ...event, part: 'guitar' });
    }
  }

  /** A one-shot drum hit on the keyboard's drum channel (R4c.13, R4c.14); 0 or no note plays nothing. */
  _drumHit(midi, time) {
    if (!midi) return;
    const columns = this.drumColumns();
    this.emit({
      type: 'noteOn',
      voiceId: newVoiceId(),
      midi,
      velocity: DIGITAL_VELOCITY,
      time,
      column: columns.indexOf(midi),
      oneShot: true,
      part: 'drums',
    });
  }

  _keyDown(code, time) {
    const midi = this.noteFor(code);
    if (midi === null) return;
    const old = this.notes.get(code);
    if (old) this._stop(code, old, time); // pressed again while sustained: restart
    const voiceId = newVoiceId();
    this.notes.set(code, { voiceId, midi, held: true, sustained: false });
    this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: midi });
  }

  _keyUp(code, time) {
    const note = this.notes.get(code);
    if (!note) return;
    note.held = false;
    if (this.sustain) note.sustained = true;
    else this._stop(code, note, time);
  }

  _pedalUp(time) {
    this.sustain = false;
    for (const [code, note] of [...this.notes]) {
      if (!note.held) this._stop(code, note, time);
      else note.sustained = false;
    }
  }

  _stop(code, note, time) {
    this.emit({ type: 'noteOff', voiceId: note.voiceId, fade: this.options.release, time });
    this.notes.delete(code);
  }

  stopAll(time = 0) {
    this.out = [];
    for (const [code, note] of [...this.notes]) this._stop(code, note, time);
    for (const e of this.guitar.stopAll(time)) this.out.push({ ...e, part: 'guitar' });
    return this.out;
  }
}
