// Guitar logic: frets, strum, whammy and tilt (design 4.2, R4).
//
// Per fret it keeps whether the button is held and the voiceId of its
// ringing note (if any).
//   - Strum (up or down edge): every held fret stops its ringing note (if any)
//     and starts a new one (R4.4); frets that are not held keep ringing
//     (R4.6). Several held frets sound together as a chord (R4.8).
//   - Fret press-down: a ringing note on that fret is muted with the short
//     fade (R4.3, R4.3.1). Fret release: nothing, the note rings on (R4.2).
//   - Experiment E: a short press of Back toggles tilt on/off for this
//     controller, on *release* (replaces R4.11, Back no longer mutes; tilt
//     starts off). Holding Back for BACK_HOLD_SECONDS (5 s) instead mutes the
//     ringing notes, turns tilt off with a 0 base and asks the UI to reset
//     this controller's settings ('resetSettings' action), right away while
//     Back is still held; that release then does nothing (see back-hold.js). Tilt makes no sound
//     effect of its own (default tilt assignment 'off'); while it is on, the
//     smoothed tilt shifts the whole fret range by scale steps:
//       steps = base + round((tilt - tiltAtEnable) / TILT_STEP_SIZE)
//     with a little hysteresis (TILT_STEP_HYSTERESIS) so the step does not
//     flicker at a boundary. Each fret moves by that many degrees within the
//     current key/scale. Ringing notes are not retuned (unless tilt glide is
//     on, see below); only new notes use the new range. Turning tilt off keeps the current steps as the new base
//     (per controller; saved as the rangeOffset device setting by the UI,
//     tilt on/off itself is not saved); turning it on again measures from a
//     new reference tilt. Start asks the UI to open the settings panel (R4.10).
//     Tilt glide (experiment E, `tiltGlide` device setting, default off):
//     while tilt is on, the sound follows the same continuous offset as the
//     note strip (displaySteps(), no hysteresis): for s = n + f every fret's
//     pitch is note(n) + f * (note(n+1) - note(n)), ringing notes included.
//     Sent as per-voice 'glide' events (semitones away from the voice's noteOn
//     midi), which the sources apply as per-voice detune on top of the
//     whammy bend; new notes start at the glided pitch (noteOn `glide`).
//     Turning tilt off then locks round(displaySteps()) (the nearest whole
//     step, the same as the strip) and ringing notes settle on that step.
//     Turning the setting off while tilt is on settles ringing notes on the
//     current whole step; from then on everything is as without glide.
//   - Whammy (and tilt, if a tilt assignment is set explicitly) become 'bend',
//     'volume' and 'vibrato' events depending on the assignment setting
//     (R4.5, see design 4.2).
//     Vibrato (experiment B): depth = deflection x VIBRATO_MAX_CENTS; the
//     audio source runs the ~5.5 Hz LFO and adds it to the current bend.
// Within one frame, fret edges are handled before strum edges, so pressing a
// fret and strumming in the same frame mutes the old note and plays a new one.
//
// Tap-to-play (design 7.4): while the device's settings panel is open, the UI
// turns on setTapToPlay(true). Then a fret press mutes that fret's ringing
// note (as above) and plays its note at once, without a strum, and releasing
// the fret stops that tapped note with the same short fade. Turning tap mode
// off leaves tapped notes ringing like strummed ones.
//
// The same class is used for the Xplorer, for a regular gamepad in guitar or
// bass mode (R2.10, through `controlNames`) and for keys 1-5 + Backspace on the
// computer keyboard (R4c.3).

import { Instrument, newVoiceId } from './instrument.js';
import { BackHold } from '../input/back-hold.js';

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

/** Vibrato depth at full deflection, in cents (±0.5 semitone). Rate is set in the sources (VIBRATO_RATE_HZ). */
export const VIBRATO_MAX_CENTS = 50;

/** Experiment E: change of the smoothed tilt (0..1) that moves the range by one scale step. */
export const TILT_STEP_SIZE = 0.1;
/** Experiment E: extra distance (in steps) past a rounding boundary before the step changes. */
export const TILT_STEP_HYSTERESIS = 0.2;
/** Experiment E: the range offset is limited to this many octaves up or down. */
export const STEP_LIMIT_OCTAVES = 3;
/** Experiment E: tilt (range shifting) is off when a controller connects. */
export const TILT_STARTS_ENABLED = false;

/**
 * Experiment E: the next step delta for tilt movement `x` (in steps, i.e.
 * (tilt - reference) / TILT_STEP_SIZE), given the current delta. Rounds to
 * the nearest step, but only leaves the current step once `x` is more than
 * 0.5 + TILT_STEP_HYSTERESIS away from it.
 */
export function stepDelta(x, current = 0) {
  if (Math.abs(x - current) <= 0.5 + TILT_STEP_HYSTERESIS) return current;
  return Math.round(x);
}

/** MIDI note `steps` scale degrees above (or below) degree `degree` of the scale from `root`. */
/**
 * Experiment E (visual only): the continuous range offset shown by the note
 * strip while tilt is on: base + (tilt - reference) / TILT_STEP_SIZE, limited
 * to +-limit. The sound still uses whole steps (rangeSteps()).
 */
export function displayOffset(base, tilt, reference, limit = Infinity) {
  const x = base + (tilt - reference) / TILT_STEP_SIZE;
  return Math.max(-limit, Math.min(limit, x));
}

/** Splits a (fractional) offset into whole steps and the fraction 0..1 above them. */
export function splitOffset(offset) {
  const whole = Math.floor(offset + 1e-9);
  const frac = offset - whole;
  return { whole, frac: frac < 1e-6 ? 0 : frac };
}

/**
 * Experiment E (tilt glide): pitch of one fret at a fractional offset
 * s = n + f, in (fractional) MIDI semitones: note(n) + f * (note(n+1) - note(n)).
 * `noteAt(steps)` is the fret's note at a whole offset (e.g. guitar.noteFor(i, steps)).
 */
export function glidePitch(noteAt, offset) {
  const { whole, frac } = splitOffset(offset);
  const a = noteAt(whole);
  return frac ? a + frac * (noteAt(whole + 1) - a) : a;
}

export function shiftInScale(root, scale, degree, steps) {
  const n = scale.length;
  const d = degree + steps;
  const octave = Math.floor(d / n);
  return root + scale[((d % n) + n) % n] + 12 * octave;
}

export const DEFAULT_GUITAR_OPTIONS = Object.freeze({
  notes: [52, 55, 57, 59, 62], // E3 G3 A3 B3 D4: E minor pentatonic (R4.9)
  // Experiment E: root and scale (semitones from the root) the notes come
  // from, used to move the fret range by scale steps with the tilt.
  rootMidi: 52,
  scale: [0, 3, 5, 7, 10],
  fade: 0.08, // seconds (R4.3.1)
  velocity: 100,
  whammy: 'bend', // 'bend' | 'volume' | 'vibrato' | 'off' (experiment E default: bend)
  tilt: 'off', // 'bend' | 'volume' | 'vibrato' | 'off' (experiment E default: off; tilt shifts the range instead)
  bendRange: -2, // semitones at full deflection (negative = down)
  tiltSmoothing: 0.08, // seconds, time constant of the tilt smoothing (R4.5.1); 0 = off
  rangeOffset: 0, // experiment E: locked range offset in scale steps (saved per device setting)
  tiltGlide: false, // experiment E: while tilt is on, the pitch glides between scale steps
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
    // glide: experiment E, the voice's current pitch offset (semitones) from midi.
    this.frets = FRETS.map(() => ({ held: false, voiceId: null, midi: null, tapped: false, glide: 0 }));
    // Experiment E: ringing notes must settle on a whole step at the next frame.
    this.glideSettlePending = false;
    this.tapToPlay = false;
    this.lastBend = null;
    this.lastGain = null;
    // Sources start without vibrato, so nothing is sent until the depth changes.
    this.lastVibrato = 0;
    // Smoothed tilt value (R4.5.1) and the time of the last tilt reading.
    this.smoothedTilt = null;
    this.lastTiltTime = null;
    // Experiment E: tilt on/off (toggled with Back, per controller, not
    // persisted), the locked base offset in scale steps, the reference tilt
    // captured when tilt was turned on and the current tilt delta in steps.
    this.tiltEnabled = TILT_STARTS_ENABLED;
    this.stepBase = 0;
    this.tiltRef = null;
    this.tiltDelta = 0;
    // Experiment E: Back tap (toggle tilt on release) vs. 5 s hold (reset).
    this.backHold = new BackHold();
    this.configure(options);
  }

  /** Applies new options (e.g. after a settings change); ringing notes are kept. */
  configure(options = {}) {
    const glideBefore = !!this.options?.tiltGlide;
    this.options = { ...DEFAULT_GUITAR_OPTIONS, ...this.options, ...options };
    // Experiment E: glide turned off while tilt is on -> ringing notes settle
    // on the current whole step at the next frame (configure() cannot emit).
    if (glideBefore && !this.options.tiltGlide && this.tiltEnabled) this.glideSettlePending = true;
    const map = this.options.controlNames || {};
    // device control name -> logical guitar control name
    this.reverse = {};
    for (const name of [...FRETS, ...STRUMS, 'whammy', 'tilt', 'start', 'back']) {
      this.reverse[map[name] || name] = name;
    }
    // Experiment E: the locked offset comes from the settings (rangeOffset).
    // If it changed (load, reset), it becomes the base; while tilt is on the
    // tilt is measured again from here, so the range is exactly the new base.
    const base = Number.isInteger(this.options.rangeOffset) ? this.options.rangeOffset : 0;
    if (base !== this.stepBase) {
      this.stepBase = base;
      if (this.tiltEnabled) {
        this.tiltDelta = 0;
        this.tiltRef = this.smoothedTilt;
      }
      // With glide, ringing notes follow the new base too.
      if (this.options.tiltGlide) this.glideSettlePending = true;
    }
    // Force bend/volume to be re-sent with the new assignment.
    this.lastBend = null;
    this.lastGain = null;
  }

  /** Turns tap-to-play on or off (on while the settings panel is open). */
  setTapToPlay(on) {
    on = !!on;
    if (on === this.tapToPlay) return;
    this.tapToPlay = on;
    // Notes tapped in the menu ring on like strummed notes after it closes.
    if (!on) for (const fret of this.frets) fret.tapped = false;
  }

  /**
   * MIDI note of fret i (0-based), moved by the current range offset
   * (experiment E). `steps` may be given to ask for another offset (the
   * note strip uses it for the labels sliding in); `i` may be outside 0..4.
   */
  noteFor(i, steps = this.rangeSteps()) {
    if (steps === 0 && i >= 0 && i < this.options.notes.length) return this.options.notes[i];
    const { rootMidi, scale } = this.options;
    return Math.max(0, Math.min(127, shiftInScale(rootMidi, scale, i, steps)));
  }

  /**
   * Experiment E: the middle note of the chosen key/scale: the note of the
   * middle (yellow, index 2) fret at range offset 0. It does not move with the
   * tilt offset or the locked base; the note strip marks it (and its octaves)
   * with orientation bars.
   */
  referenceMidi() {
    return this.noteFor(2, 0);
  }

  /** Experiment E: largest allowed range offset in steps (STEP_LIMIT_OCTAVES octaves of the scale). */
  stepLimit() {
    return STEP_LIMIT_OCTAVES * Math.max(1, this.options.scale.length);
  }

  /** Experiment E: current range offset in scale steps (base + tilt delta while tilt is on). */
  rangeSteps() {
    const limit = this.stepLimit();
    const total = this.stepBase + (this.tiltEnabled ? this.tiltDelta : 0);
    return Math.max(-limit, Math.min(limit, total));
  }

  /**
   * Experiment E (visual only): the fractional range offset for the note
   * strip. While tilt is on it follows the smoothed tilt continuously; while
   * it is off it is the locked whole-step offset (so the strip snaps).
   */
  displaySteps() {
    if (!this.tiltEnabled || this.tiltRef === null || this.smoothedTilt === null) return this.rangeSteps();
    return displayOffset(this.stepBase, this.smoothedTilt, this.tiltRef, this.stepLimit());
  }

  /** Experiment E: true while the pitch glides with the tilt (setting on and tilt on). */
  glideActive() {
    return !!this.options.tiltGlide && this.tiltEnabled;
  }

  /**
   * Experiment E: the range offset the sound uses: the continuous strip offset
   * while gliding, else the whole-step offset (rangeSteps()).
   */
  soundOffset() {
    return this.glideActive() ? this.displaySteps() : this.rangeSteps();
  }

  /** Experiment E: (fractional) MIDI pitch of fret i at `offset` (default: soundOffset()). */
  pitchFor(i, offset = this.soundOffset()) {
    return glidePitch((steps) => this.noteFor(i, steps), offset);
  }

  /** True: this instrument handles the Back tap/hold itself (main.js does not). */
  get handlesBackHold() {
    return true;
  }

  /** Forgets a pending Back press, e.g. while a gamepad menu owns Back. */
  cancelBackHold() {
    this.backHold.cancel();
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
        if (this.tapToPlay) {
          this._play(fret, i, time);
          fret.tapped = true;
        }
      } else if (e.type === 'released') {
        fret.held = false; // R4.2: keeps ringing
        if (fret.tapped) this._mute(fret, time); // tap-to-play: release stops the tapped note
      }
    }

    // 2. Strum: one strum per frame is enough even if up and down both fired.
    if (named.some((e) => STRUMS.includes(e.name) && e.type === 'pressed')) this._strum(time);

    // 3. Start / Back. Experiment E: Back toggles tilt on release of a short
    // press, a 5 s hold resets (replaces R4.11).
    for (const e of named) {
      if (e.name === 'back') {
        if (e.type === 'pressed') this.backHold.press(time);
        else if (e.type === 'released') {
          const r = this.backHold.release(time);
          if (r === 'tap') this.toggleTilt(time);
          else if (r === 'hold') this.resetToDefaults(time);
        }
      } else if (e.type === 'pressed' && e.name === 'start') this.emit({ type: 'action', action: 'openSettings', time }); // R4.10
    }
    if (this.backHold.update(time) === 'hold') this.resetToDefaults(time);

    // 4. Whammy / tilt (R4.5).
    this._expression(controls, time);
  }

  _strum(time) {
    this.frets.forEach((fret, i) => {
      if (!fret.held) return; // R4.6
      this._mute(fret, time); // R4.4: a ringing note from an earlier strum restarts
      this._play(fret, i, time);
    });
  }

  _play(fret, i, time) {
    const voiceId = newVoiceId();
    if (this.glideActive()) {
      // Experiment E: the note of the whole step below, detuned up to the glided pitch.
      // (0.01 tolerance: a smoothed tilt resting a hair below a whole step uses that
      // step's own note instead of the step below plus an almost-full-step glide.)
      const offset = this.displaySteps();
      const midi = this.noteFor(i, splitOffset(offset + 0.01).whole);
      const glide = this.pitchFor(i, offset) - midi;
      fret.voiceId = voiceId;
      fret.midi = midi;
      fret.glide = glide;
      this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: i, glide });
      return;
    }
    const midi = this.noteFor(i);
    fret.voiceId = voiceId;
    fret.midi = midi;
    fret.glide = 0;
    this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: i });
  }

  /** Experiment E: sends a 'glide' event when a ringing fret's pitch offset changed. */
  _setGlide(fret, semitones, time) {
    if (fret.voiceId === null || Math.abs(semitones - fret.glide) <= 0.001) return;
    fret.glide = semitones;
    this.emit({ type: 'glide', voiceId: fret.voiceId, semitones, time });
  }

  /** Experiment E: while gliding, every ringing fret follows the continuous offset. */
  _updateGlide(time) {
    if (!this.glideActive()) return;
    const offset = this.displaySteps();
    this.frets.forEach((fret, i) => {
      if (fret.voiceId !== null) this._setGlide(fret, this.pitchFor(i, offset) - fret.midi, time);
    });
  }

  /** Experiment E: ringing frets settle on whole-step offset `steps` (end of a glide). */
  _settleGlide(steps, time) {
    this.frets.forEach((fret, i) => {
      if (fret.voiceId !== null) this._setGlide(fret, this.noteFor(i, steps) - fret.midi, time);
    });
  }

  _mute(fret, time) {
    fret.tapped = false;
    if (fret.voiceId === null) return;
    this.emit({ type: 'noteOff', voiceId: fret.voiceId, fade: this.options.fade, time });
    fret.voiceId = null;
    fret.midi = null;
    fret.glide = 0;
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

  /**
   * Experiment E: turns tilt on/off and tells the UI (toast, pill). Turning
   * it on captures the current smoothed tilt as the reference (or the next
   * reading, if there is none yet); turning it off keeps the current offset
   * as the new base.
   */
  toggleTilt(time) {
    if (this.tiltEnabled) {
      // Experiment E: with glide the sound is at the continuous offset, so
      // lock the nearest whole step to it (the strip snaps there too) and let
      // ringing notes settle on it. Without glide: the step the sound uses.
      const limit = this.stepLimit();
      this.stepBase = this.options.tiltGlide ? Math.max(-limit, Math.min(limit, Math.round(this.displaySteps()))) : this.rangeSteps();
      if (this.options.tiltGlide) this._settleGlide(this.stepBase, time);
      // Keep the options in step; the UI saves it as the rangeOffset setting.
      this.options = { ...this.options, rangeOffset: this.stepBase };
      this.tiltDelta = 0;
      this.tiltRef = null;
      this.tiltEnabled = false;
    } else {
      this.tiltEnabled = true;
      this.tiltDelta = 0;
      this.tiltRef = this.smoothedTilt;
    }
    this.emit({ type: 'action', action: 'tiltToggled', enabled: this.tiltEnabled, steps: this.rangeSteps(), base: this.stepBase, time });
  }

  /**
   * Experiment E: Back held for 5 s. Ringing notes are muted with the soft
   * fade (the sound settings may change with the reset), tilt is turned off
   * and the locked offset goes back to 0. The UI then resets this
   * controller's stored settings and shows a toast.
   */
  resetToDefaults(time) {
    this._muteAll(time);
    this.tiltEnabled = TILT_STARTS_ENABLED;
    this.stepBase = 0;
    this.options = { ...this.options, rangeOffset: 0 };
    this.tiltDelta = 0;
    this.tiltRef = null;
    this.emit({ type: 'action', action: 'resetSettings', time });
  }

  /** Experiment E: updates the tilt delta (in steps) from the smoothed tilt while tilt is on. */
  _updateTiltSteps(value) {
    if (!this.tiltEnabled) return;
    if (this.tiltRef === null) this.tiltRef = value;
    const limit = this.stepLimit();
    const delta = stepDelta((value - this.tiltRef) / TILT_STEP_SIZE, this.tiltDelta);
    // Keep base + delta inside the limits (the range stays at the limit while tilted further).
    this.tiltDelta = Math.max(-limit - this.stepBase, Math.min(limit - this.stepBase, delta));
  }

  /**
   * Time-based exponential moving average of the tilt (R4.5.1, design 4.2):
   * smoothed += (raw - smoothed) * (1 - e^(-dt/tau)). Frame-rate independent;
   * the first reading (or tau = 0) is taken as is.
   */
  _smoothTilt(raw, time) {
    const tau = this.options.tiltSmoothing;
    if (this.smoothedTilt === null || !(tau > 0) || this.lastTiltTime === null) {
      this.smoothedTilt = raw;
    } else {
      const dt = Math.max(0, time - this.lastTiltTime);
      this.smoothedTilt += (raw - this.smoothedTilt) * (1 - Math.exp(-dt / tau));
    }
    this.lastTiltTime = time;
    return this.smoothedTilt;
  }

  _expression(controls, time) {
    let semitones = 0;
    let gain = 1;
    let cents = 0;
    for (const name of ['whammy', 'tilt']) {
      const deviceName = (this.options.controlNames || {})[name] || name;
      const control = controls[deviceName];
      if (!control) continue; // e.g. a gamepad in guitar mode has no whammy
      const value = name === 'tilt' ? this._smoothTilt(control.value, time) : control.value;
      // The smoothing keeps running while tilt is off, so turning it on
      // captures the current smoothed value as the reference (experiment E).
      if (name === 'tilt') this._updateTiltSteps(value);
      const d = deflection(name, value);
      const target = this.options[name];
      if (target === 'bend') semitones += d * this.options.bendRange;
      else if (target === 'volume') gain *= VOLUME_MIN + (1 - VOLUME_MIN) * d;
      else if (target === 'vibrato') cents += d * VIBRATO_MAX_CENTS;
    }
    // Experiment E: tilt glide follows the smoothed tilt; a pending settle
    // (glide turned off, or base changed) puts ringing notes on a whole step.
    if (this.glideSettlePending) {
      this.glideSettlePending = false;
      if (!this.glideActive()) this._settleGlide(this.rangeSteps(), time);
    }
    this._updateGlide(time);
    if (this.lastBend === null || Math.abs(semitones - this.lastBend) > 0.001) {
      this.lastBend = semitones;
      this.emit({ type: 'bend', semitones, time });
    }
    if (this.lastGain === null || Math.abs(gain - this.lastGain) > 0.001) {
      this.lastGain = gain;
      this.emit({ type: 'volume', gain, time });
    }
    if (Math.abs(cents - this.lastVibrato) > 0.1 || (cents === 0 && this.lastVibrato !== 0)) {
      this.lastVibrato = cents;
      this.emit({ type: 'vibrato', cents, time });
    }
  }
}
