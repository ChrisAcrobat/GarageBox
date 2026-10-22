// Guitar logic: frets, strum, whammy and tilt (design 4.2, R4).
//
// Per fret it keeps whether the button is held and the voiceId of its
// ringing note (if any).
//   - Strum (up or down edge): every held fret stops its ringing note (if any)
//     and starts a new one (R4.4); frets that are not held keep ringing
//     (R4.6). Several held frets sound together as a chord (R4.8).
//   - Fret press-down: a ringing note on that fret is muted with the short
//     fade (R4.3, R4.3.1). Fret release: nothing, the note rings on (R4.2).
//   - Back mutes everything with the same fade (R4.11); Start asks the UI to
//     open the settings panel (R4.10).
//   - Whammy and tilt become 'bend' and 'volume' events depending on the
//     whammy/tilt assignment setting (R4.5, see design 4.2).
// Within one frame, fret edges are handled before strum edges, so pressing a
// fret and strumming in the same frame mutes the old note and plays a new one.
//
// The same class is used for the Xplorer, for a regular gamepad in guitar or
// bass mode (R2.10, through `controlNames`) and for keys 1-5 + Backspace on the
// computer keyboard (R4c.3).

import { Instrument, newVoiceId } from './instrument.js';

export const FRET_COUNT = 5;
const FRETS = ['fret1', 'fret2', 'fret3', 'fret4', 'fret5'];
const STRUMS = ['strumUp', 'strumDown', 'strum'];

/**
 * Regular gamepad in guitar/bass mode (R2.10): the Xbox face button colors
 * match the Guitar Hero fret colors (A green, B red, Y yellow, X blue), the
 * left shoulder button is orange, and the D-pad up/down is the strum bar.
 */
export const GAMEPAD_GUITAR_CONTROLS = Object.freeze({
  fret1: 'faceA',
  fret2: 'faceB',
  fret3: 'faceY',
  fret4: 'faceX',
  fret5: 'shoulderL',
  strumUp: 'dpadUp',
  strumDown: 'dpadDown',
});

/**
 * Tilt value (0..1 after mapping) that counts as "held normally". Below it the
 * tilt does nothing; between it and 1 (neck pointing up) the effect grows.
 * The Xplorer rests at about 0.44 when held flat (raw axis +0.12, inverted).
 */
export const TILT_REST = 0.5;

/** Volume at zero deflection when a control is assigned to volume; full deflection = 1. */
export const VOLUME_MIN = 0.5;

export const DEFAULT_GUITAR_OPTIONS = Object.freeze({
  notes: [52, 55, 57, 59, 62], // E3 G3 A3 B3 D4: E minor pentatonic (R4.9)
  fade: 0.08, // seconds (R4.3.1)
  velocity: 100,
  whammy: 'bend', // 'bend' | 'volume' | 'off'
  tilt: 'volume', // 'bend' | 'volume' | 'off'
  bendRange: -2, // semitones at full deflection (negative = down)
  controlNames: null, // logical name -> device control name, e.g. GAMEPAD_GUITAR_CONTROLS
});

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** How far a control is deflected from rest, 0..1. */
export function deflection(name, value) {
  if (name === 'tilt') return clamp01((value - TILT_REST) / (1 - TILT_REST));
  return clamp01(value);
}

export class Guitar extends Instrument {
  constructor(options = {}) {
    super();
    this.frets = FRETS.map(() => ({ held: false, voiceId: null, midi: null }));
    this.lastBend = null;
    this.lastGain = null;
    this.configure(options);
  }

  /** Applies new options (e.g. after a settings change); ringing notes are kept. */
  configure(options = {}) {
    this.options = { ...DEFAULT_GUITAR_OPTIONS, ...this.options, ...options };
    const map = this.options.controlNames || {};
    // device control name -> logical guitar control name
    this.reverse = {};
    for (const name of [...FRETS, ...STRUMS, 'whammy', 'tilt', 'start', 'back']) {
      this.reverse[map[name] || name] = name;
    }
    // Force bend/volume to be re-sent with the new assignment.
    this.lastBend = null;
    this.lastGain = null;
  }

  /** MIDI note of fret i (0-based). */
  noteFor(i) {
    return this.options.notes[i];
  }

  process(edges, controls, time) {
    const named = edges
      .map((e) => ({ ...e, name: this.reverse[e.name] }))
      .filter((e) => e.name);

    // 1. Frets.
    for (const e of named) {
      const i = FRETS.indexOf(e.name);
      if (i < 0) continue;
      const fret = this.frets[i];
      if (e.type === 'pressed') {
        fret.held = true;
        this._mute(fret, time); // R4.3
      } else if (e.type === 'released') {
        fret.held = false; // R4.2: keeps ringing
      }
    }

    // 2. Strum: one strum per frame is enough even if up and down both fired.
    if (named.some((e) => STRUMS.includes(e.name) && e.type === 'pressed')) this._strum(time);

    // 3. Start / Back.
    for (const e of named) {
      if (e.type !== 'pressed') continue;
      if (e.name === 'back') this._muteAll(time); // R4.11
      else if (e.name === 'start') this.emit({ type: 'action', action: 'openSettings', time }); // R4.10
    }

    // 4. Whammy / tilt (R4.5).
    this._expression(controls, time);
  }

  _strum(time) {
    this.frets.forEach((fret, i) => {
      if (!fret.held) return; // R4.6
      this._mute(fret, time); // R4.4: a ringing note from an earlier strum restarts
      const voiceId = newVoiceId();
      const midi = this.noteFor(i);
      fret.voiceId = voiceId;
      fret.midi = midi;
      this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: i });
    });
  }

  _mute(fret, time) {
    if (fret.voiceId === null) return;
    this.emit({ type: 'noteOff', voiceId: fret.voiceId, fade: this.options.fade, time });
    fret.voiceId = null;
    fret.midi = null;
  }

  _muteAll(time) {
    for (const fret of this.frets) this._mute(fret, time);
  }

  stopAll(time = 0) {
    this.out = [];
    this._muteAll(time);
    return this.out;
  }

  /** Voice ids of frets with a note started by this instrument (not yet muted). */
  ringingVoices() {
    return this.frets.map((f) => f.voiceId);
  }

  _expression(controls, time) {
    let semitones = 0;
    let gain = 1;
    for (const name of ['whammy', 'tilt']) {
      const deviceName = (this.options.controlNames || {})[name] || name;
      const control = controls[deviceName];
      if (!control) continue; // e.g. a gamepad in guitar mode has no whammy
      const d = deflection(name, control.value);
      const target = this.options[name];
      if (target === 'bend') semitones += d * this.options.bendRange;
      else if (target === 'volume') gain *= VOLUME_MIN + (1 - VOLUME_MIN) * d;
    }
    if (this.lastBend === null || Math.abs(semitones - this.lastBend) > 0.001) {
      this.lastBend = semitones;
      this.emit({ type: 'bend', semitones, time });
    }
    if (this.lastGain === null || Math.abs(gain - this.lastGain) > 0.001) {
      this.lastGain = gain;
      this.emit({ type: 'volume', gain, time });
    }
  }
}
