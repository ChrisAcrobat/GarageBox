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

import { Instrument, newVoiceId } from './instrument.js';
import { Guitar } from './guitar.js';

/** Semitones from the base note (C4 = 60 by default) per KeyboardEvent.code. */
export const KEY_OFFSETS = Object.freeze({
  // Home row: white keys C4..D5
  KeyA: 0, KeyS: 2, KeyD: 4, KeyF: 5, KeyG: 7, KeyH: 9, KeyJ: 11, KeyK: 12, KeyL: 14,
  // Row above: black keys, between the home-row keys they sit between
  KeyW: 1, KeyE: 3, KeyT: 6, KeyY: 8, KeyU: 10, KeyO: 13, KeyP: 15,
  // Bottom row: white keys C3..B3
  KeyZ: -12, KeyX: -10, KeyC: -8, KeyV: -7, KeyB: -5, KeyN: -3, KeyM: -1,
});

export const DEFAULT_KEYS_OPTIONS = Object.freeze({
  base: 60,
  velocity: 100,
  release: 0.15, // seconds, short soft release (R4c.9)
  guitar: {},
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
    this.guitar = new Guitar(options.guitar || {});
    this.configure(options);
  }

  configure(options = {}) {
    this.options = { ...DEFAULT_KEYS_OPTIONS, ...this.options, ...options };
    if (options.guitar) this.guitar.configure(options.guitar);
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
    // Modifiers first, so a note pressed together with Shift/Alt is shifted.
    for (const e of edges) {
      if (e.name === 'octaveUp') this.octaveUp = e.type === 'pressed';
      else if (e.name === 'octaveDown') this.octaveDown = e.type === 'pressed';
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
