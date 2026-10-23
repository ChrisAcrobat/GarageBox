// Guitar logic: frets, strum, whammy, tilt, Back and the D-pad (design 4.2, R4).
//
// Per fret it keeps whether the button is held and the voiceId of its
// ringing note (if any).
//   - Strum (up or down edge): every held fret stops its ringing note (if any)
//     and starts a new one (R4.4); frets that are not held keep ringing
//     (R4.6). Several held frets sound together as a chord (R4.8).
//   - Fret press-down: a ringing note on that fret is muted with the mute
//     fade (R4.3, R4.3.1). Fret release: nothing, the note rings on (R4.2).
//   - Whammy (R4.5): 'bend' (deflection x bendRange), 'volume' or 'off'. The
//     tilt never makes a sound effect of its own.
//   - Back (R4.11): a short press toggles tilt range shifting on release.
//     Held 5 s it mutes the ringing notes, turns tilt off with a 0 base and
//     asks the UI to reset the settings (keeping the instrument, R4.11.2);
//     held 10 s it asks for a full reset (R4.11.3). See back-hold.js.
//   - Tilt range shifting (R4.5.2 - R4.5.7): while tilt is on, the smoothed
//     tilt shifts the whole fret range by scale steps:
//       steps = base + round((tilt - tiltAtEnable) / TILT_STEP_SIZE)
//     with a little hysteresis (TILT_STEP_HYSTERESIS) so the step does not
//     flicker at a boundary. Ringing notes are not retuned (unless tilt glide
//     is on); only new notes use the new range. Turning tilt off keeps the
//     current steps as the new base (saved as the rangeOffset setting by the
//     UI; tilt on/off itself is not saved).
//   - Tilt glide (R4.14, setting tiltGlide): while tilt is on, the sound
//     follows the same continuous offset as the note strip (displaySteps()):
//     for s = n + f every fret's pitch is note(n) + f * (note(n+1) - note(n)),
//     ringing notes included. Sent as per-voice 'glide' events (semitones
//     from the voice's noteOn midi), applied by the sources as per-voice
//     detune on top of the whammy bend; new notes start at the glided pitch
//     (noteOn `glide`). Turning tilt off locks round(displaySteps()) and
//     ringing notes settle on that step.
//   - D-pad left/right (R4.15, setting dpadAction): 'octave' shifts the range
//     by one octave of the scale (rangeShifted action); 'effect', 'key' and
//     'sound' emit a 'dpad' action that main.js turns into a settings change;
//     'off' does nothing.
//   - Star power (R5.5, option starPower): see visual/star-power.js.
//   - Start asks the UI to open the settings panel (R4.10).
// Within one frame, fret edges are handled before strum edges, so pressing a
// fret and strumming in the same frame mutes the old note and plays a new one.
//
// Tap-to-play (design 7.4): while the device's settings panel is open as a
// gamepad menu, the UI turns on setTapToPlay(true). Then a fret press mutes
// that fret's ringing note (as above) and plays its note at once, without a
// strum, and releasing the fret stops that tapped note with the same fade.
// Turning tap mode off leaves tapped notes ringing like strummed ones.
//
// The same class is used for the Xplorer, for a regular gamepad in guitar or
// bass mode (R2.10, through `controlNames`) and for keys 1-5 + Backspace on the
// computer keyboard (R4c.3).

import { Instrument, newVoiceId } from './instrument.js';
import { BackHold } from '../input/back-hold.js';
import { StarPowerTrigger } from '../visual/star-power.js';

export const FRET_COUNT = 5;
const FRETS = ['fret1', 'fret2', 'fret3', 'fret4', 'fret5'];
const STRUMS = ['strumUp', 'strumDown', 'strum'];
const DPAD = { dpadLeft: -1, dpadRight: 1 };

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
  dpadLeft: 'dpadLeft', // D-pad action (R4.15)
  dpadRight: 'dpadRight',
});

/**
 * Tilt value (0..1 after mapping) that counts as "held normally" for
 * deflection(): below it the deflection is 0. The Xplorer rests at about 0.44
 * when held flat (raw axis +0.12, inverted). The tilt makes no sound effect.
 */
export const TILT_REST = 0.5;

/** Volume at zero whammy deflection when the whammy is set to volume; full deflection = 1. */
export const VOLUME_MIN = 0.5;

/** Change of the smoothed tilt (0..1) that moves the range by one scale step. */
export const TILT_STEP_SIZE = 0.1;
/** Extra distance (in steps) past a rounding boundary before the step changes. */
export const TILT_STEP_HYSTERESIS = 0.2;
/** The range offset is limited to this many octaves up or down. */
export const STEP_LIMIT_OCTAVES = 3;
/** Tilt (range shifting) is off when a controller connects. */
export const TILT_STARTS_ENABLED = false;

/**
 * The next step delta for tilt movement `x` (in steps, i.e.
 * (tilt - reference) / TILT_STEP_SIZE), given the current delta. Rounds to
 * the nearest step, but only leaves the current step once `x` is more than
 * 0.5 + TILT_STEP_HYSTERESIS away from it.
 */
export function stepDelta(x, current = 0) {
  if (Math.abs(x - current) <= 0.5 + TILT_STEP_HYSTERESIS) return current;
  return Math.round(x);
}

/**
 * The continuous range offset shown by the note strip while tilt is on (R5.7):
 * base + (tilt - reference) / TILT_STEP_SIZE, limited to +-limit. The sound
 * uses whole steps (rangeSteps()) unless tilt glide is on.
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
 * Tilt glide (R4.14): pitch of one fret at a fractional offset
 * s = n + f, in (fractional) MIDI semitones: note(n) + f * (note(n+1) - note(n)).
 * `noteAt(steps)` is the fret's note at a whole offset (e.g. guitar.noteFor(i, steps)).
 */
export function glidePitch(noteAt, offset) {
  const { whole, frac } = splitOffset(offset);
  const a = noteAt(whole);
  return frac ? a + frac * (noteAt(whole + 1) - a) : a;
}

/** MIDI note `steps` scale degrees above (or below) degree `degree` of the scale from `root`. */
export function shiftInScale(root, scale, degree, steps) {
  const n = scale.length;
  const d = degree + steps;
  const octave = Math.floor(d / n);
  return root + scale[((d % n) + n) % n] + 12 * octave;
}

export const DEFAULT_GUITAR_OPTIONS = Object.freeze({
  notes: [52, 55, 57, 59, 62], // E3 G3 A3 B3 D4: E minor pentatonic (R4.9)
  // Root and scale (semitones from the root) the notes come from, used to
  // move the fret range by scale steps (tilt, D-pad octave).
  rootMidi: 52,
  scale: [0, 3, 5, 7, 10],
  fade: 1, // seconds (R4.3.1)
  velocity: 100,
  whammy: 'bend', // 'bend' | 'volume' | 'off' (R4.5)
  bendRange: -2, // semitones at full deflection (negative = down)
  tiltSmoothing: 0.08, // seconds, time constant of the tilt smoothing (R4.5.1); 0 = off
  rangeOffset: 0, // locked range offset in scale steps (the rangeOffset setting, R4.5.6)
  tiltGlide: false, // while tilt is on, the pitch glides between scale steps (R4.14)
  dpadAction: 'octave', // 'octave' | 'effect' | 'key' | 'sound' | 'off' (R4.15)
  starPower: false, // star power trigger on (setup.js: device has whammy and tilt, setting on)
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
    // glide: the voice's current pitch offset (semitones) from midi (R4.14).
    this.frets = FRETS.map(() => ({ held: false, voiceId: null, midi: null, tapped: false, glide: 0 }));
    // Ringing notes must settle on a whole step at the next frame (tilt glide).
    this.glideSettlePending = false;
    // Strum hold (R4.7.2): strum controls currently down, and the voices
    // started by strums while they are down (they get holdEnd on release).
    this.strumsDown = new Set();
    this.heldVoices = new Set();
    this.tapToPlay = false;
    this.lastBend = null;
    this.lastGain = null;
    // Smoothed tilt value (R4.5.1) and the time of the last tilt reading.
    this.smoothedTilt = null;
    this.lastTiltTime = null;
    // Tilt range shifting (R4.5.2): tilt on/off (toggled with Back, not
    // saved), the locked base offset in scale steps, the reference tilt
    // captured when tilt was turned on and the current tilt delta in steps.
    this.tiltEnabled = TILT_STARTS_ENABLED;
    this.stepBase = 0;
    this.tiltRef = null;
    this.tiltDelta = 0;
    // Back tap (toggle tilt on release) vs. 5 s / 10 s holds (resets).
    this.backHold = new BackHold();
    this.starPower = new StarPowerTrigger();
    this.configure(options);
  }

  /** Applies new options (e.g. after a settings change); ringing notes are kept. */
  configure(options = {}) {
    const glideBefore = !!this.options?.tiltGlide;
    this.options = { ...DEFAULT_GUITAR_OPTIONS, ...this.options, ...options };
    // Glide turned off while tilt is on -> ringing notes settle on the
    // current whole step at the next frame (configure() cannot emit).
    if (glideBefore && !this.options.tiltGlide && this.tiltEnabled) this.glideSettlePending = true;
    const map = this.options.controlNames || {};
    // device control name -> logical guitar control name
    this.reverse = {};
    for (const name of [...FRETS, ...STRUMS, ...Object.keys(DPAD), 'whammy', 'tilt', 'start', 'back']) {
      this.reverse[map[name] || name] = name;
    }
    // The locked offset comes from the settings (rangeOffset). If it changed
    // (load, reset), it becomes the base; while tilt is on the tilt is
    // measured again from here, so the range is exactly the new base.
    const base = Number.isInteger(this.options.rangeOffset) ? this.options.rangeOffset : 0;
    if (base !== this.stepBase) this._setBase(base);
    // Force bend/volume to be re-sent with the new assignment.
    this.lastBend = null;
    this.lastGain = null;
  }

  /** Locks a new base offset; with tilt on, the tilt is measured again from the current angle. */
  _setBase(base) {
    this.stepBase = base;
    this.options = { ...this.options, rangeOffset: base };
    if (this.tiltEnabled) {
      this.tiltDelta = 0;
      this.tiltRef = this.smoothedTilt;
    }
    // With glide, ringing notes follow the new base too.
    if (this.options.tiltGlide) this.glideSettlePending = true;
  }

  /** Turns tap-to-play on or off (on while the settings panel is open as a gamepad menu). */
  setTapToPlay(on) {
    on = !!on;
    if (on === this.tapToPlay) return;
    this.tapToPlay = on;
    // Notes tapped in the menu ring on like strummed notes after it closes.
    if (!on) for (const fret of this.frets) fret.tapped = false;
  }

  /**
   * MIDI note of fret i (0-based), moved by the current range offset.
   * `steps` may be given to ask for another offset (the note strip uses it
   * for the labels sliding in); `i` may be outside 0..4.
   */
  noteFor(i, steps = this.rangeSteps()) {
    if (steps === 0 && i >= 0 && i < this.options.notes.length) return this.options.notes[i];
    const { rootMidi, scale } = this.options;
    return Math.max(0, Math.min(127, shiftInScale(rootMidi, scale, i, steps)));
  }

  /**
   * The middle note of the chosen key/scale (R5.8): the note of the middle
   * (yellow, index 2) fret at range offset 0. It does not move with the tilt
   * offset or the locked base; the note strip marks it (and its octaves)
   * with orientation bars.
   */
  referenceMidi() {
    return this.noteFor(2, 0);
  }

  /** Largest allowed range offset in steps (STEP_LIMIT_OCTAVES octaves of the scale, R4.5.5). */
  stepLimit() {
    return STEP_LIMIT_OCTAVES * Math.max(1, this.options.scale.length);
  }

  /** Current range offset in scale steps (base + tilt delta while tilt is on). */
  rangeSteps() {
    const limit = this.stepLimit();
    const total = this.stepBase + (this.tiltEnabled ? this.tiltDelta : 0);
    return Math.max(-limit, Math.min(limit, total));
  }

  /**
   * The fractional range offset for the note
   * strip. While tilt is on it follows the smoothed tilt continuously; while
   * it is off it is the locked whole-step offset (so the strip snaps).
   */
  displaySteps() {
    if (!this.tiltEnabled || this.tiltRef === null || this.smoothedTilt === null) return this.rangeSteps();
    return displayOffset(this.stepBase, this.smoothedTilt, this.tiltRef, this.stepLimit());
  }

  /** True while the pitch glides with the tilt (setting on and tilt on). */
  glideActive() {
    return !!this.options.tiltGlide && this.tiltEnabled;
  }

  /**
   * The range offset the sound uses: the continuous strip offset
   * while gliding, else the whole-step offset (rangeSteps()).
   */
  soundOffset() {
    return this.glideActive() ? this.displaySteps() : this.rangeSteps();
  }

  /** (Fractional) MIDI pitch of fret i at `offset` (default: soundOffset()). */
  pitchFor(i, offset = this.soundOffset()) {
    return glidePitch((steps) => this.noteFor(i, steps), offset);
  }

  /** True: this instrument handles the Back tap/holds itself (main.js does not). */
  get handlesBackHold() {
    return true;
  }

  /** Forgets a pending Back press, e.g. while a gamepad menu owns Back (R4.11.1). */
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
    // The strummed voices are held while any strum control is down (R4.7.2);
    // the hold ends once none is down after this frame's edges, so a press
    // and release in one frame sends noteOn (hold) and holdEnd together.
    let strummed = false;
    for (const e of named) {
      if (!STRUMS.includes(e.name)) continue;
      if (e.type === 'pressed') {
        this.strumsDown.add(e.name);
        strummed = true;
      } else if (e.type === 'released') {
        this.strumsDown.delete(e.name);
      }
    }
    if (strummed) this._strum(time);
    if (this.strumsDown.size === 0) this._endHold(time);

    // 3. Start, Back (tap toggles tilt on release, holds reset) and the D-pad action.
    for (const e of named) {
      if (e.name === 'back') {
        if (e.type === 'pressed') this.backHold.press(time);
        else if (e.type === 'released') this._backResult(this.backHold.release(time), time);
      } else if (e.type === 'pressed' && e.name === 'start') {
        this.emit({ type: 'action', action: 'openSettings', time }); // R4.10
      } else if (e.type === 'pressed' && e.name in DPAD) {
        this._dpad(DPAD[e.name], time);
      }
    }
    this._backResult(this.backHold.update(time), time);

    // 4. Whammy and tilt (R4.5), star power (R5.5).
    this._expression(controls, time);
    this._starPower(controls, time);
  }

  /** Acts on a BackHold result: 'tap' toggles tilt, 'hold' / 'fullReset' reset (R4.11 - R4.11.3). */
  _backResult(result, time) {
    if (result === 'tap') this.toggleTilt(time);
    else if (result === 'hold') this.resetToDefaults(time, false);
    else if (result === 'fullReset') this.resetToDefaults(time, true);
  }

  /** D-pad left (-1) / right (+1) press (R4.15). */
  _dpad(dir, time) {
    const action = this.options.dpadAction;
    if (action === 'octave') this.shiftOctave(dir, time);
    else if (action === 'effect' || action === 'key' || action === 'sound') this.emit({ type: 'action', action: 'dpad', dir, time });
  }

  /**
   * Shifts the range by one octave of the scale (scale.length steps), within
   * the step limit (R4.15). It locks the new range like Back does; with tilt
   * on, the tilt is measured again from the current angle and stays on.
   */
  shiftOctave(dir, time) {
    const limit = this.stepLimit();
    const to = Math.max(-limit, Math.min(limit, this.rangeSteps() + dir * this.options.scale.length));
    this._setBase(to);
    this.emit({ type: 'action', action: 'rangeShifted', base: to, steps: this.rangeSteps(), time });
  }

  _strum(time) {
    this.frets.forEach((fret, i) => {
      if (!fret.held) return; // R4.6
      this._mute(fret, time); // R4.4: a ringing note from an earlier strum restarts
      this._play(fret, i, time, true);
    });
  }

  /** Sends holdEnd for every held voice (strum released, R4.7.2). */
  _endHold(time) {
    for (const voiceId of this.heldVoices) this.emit({ type: 'holdEnd', voiceId, time });
    this.heldVoices.clear();
  }

  /**
   * Ends a strum hold at once, e.g. when a controller menu takes the strum
   * bar (design 7.4). Returns the holdEnd events; the later strum release
   * then does nothing.
   */
  releaseStrumHold(time = 0) {
    this.out = [];
    this._endHold(time);
    this.strumsDown.clear();
    return this.out;
  }

  /** Starts fret i's note; `hold` for strummed notes (strum hold, R4.7.2), never for tap-to-play. */
  _play(fret, i, time, hold = false) {
    const voiceId = newVoiceId();
    const held = hold ? { hold: true } : {};
    if (hold) this.heldVoices.add(voiceId);
    if (this.glideActive()) {
      // The note of the whole step below, detuned up to the glided pitch.
      // (0.01 tolerance: a smoothed tilt resting a hair below a whole step uses that
      // step's own note instead of the step below plus an almost-full-step glide.)
      const offset = this.displaySteps();
      const midi = this.noteFor(i, splitOffset(offset + 0.01).whole);
      const glide = this.pitchFor(i, offset) - midi;
      fret.voiceId = voiceId;
      fret.midi = midi;
      fret.glide = glide;
      this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: i, glide, ...held });
      return;
    }
    const midi = this.noteFor(i);
    fret.voiceId = voiceId;
    fret.midi = midi;
    fret.glide = 0;
    this.emit({ type: 'noteOn', voiceId, midi, velocity: this.options.velocity, time, column: i, ...held });
  }

  /** Sends a 'glide' event when a ringing fret's pitch offset changed. */
  _setGlide(fret, semitones, time) {
    if (fret.voiceId === null || Math.abs(semitones - fret.glide) <= 0.001) return;
    fret.glide = semitones;
    this.emit({ type: 'glide', voiceId: fret.voiceId, semitones, time });
  }

  /** While gliding, every ringing fret follows the continuous offset. */
  _updateGlide(time) {
    if (!this.glideActive()) return;
    const offset = this.displaySteps();
    this.frets.forEach((fret, i) => {
      if (fret.voiceId !== null) this._setGlide(fret, this.pitchFor(i, offset) - fret.midi, time);
    });
  }

  /** Ringing frets settle on whole-step offset `steps` (end of a glide). */
  _settleGlide(steps, time) {
    this.frets.forEach((fret, i) => {
      if (fret.voiceId !== null) this._setGlide(fret, this.noteFor(i, steps) - fret.midi, time);
    });
  }

  _mute(fret, time) {
    fret.tapped = false;
    if (fret.voiceId === null) return;
    // A muted voice already gets its noteOff, so no holdEnd follows.
    this.heldVoices.delete(fret.voiceId);
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
   * Turns tilt range shifting on/off (R4.11). Turning it on captures the
   * current smoothed tilt as the reference (or the next reading, if there is
   * none yet); turning it off keeps the current offset as the new base.
   */
  toggleTilt(time) {
    if (this.tiltEnabled) {
      // With glide the sound is at the continuous offset, so lock the nearest
      // whole step to it (the strip snaps there too) and let ringing notes
      // settle on it. Without glide: the step the sound uses.
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
   * Back held for 5 s (full = false) or 10 s (full = true). Ringing notes are
   * muted with the fade (the sound settings change with the reset), tilt is
   * turned off and the locked offset goes back to 0. The UI then resets this
   * controller's stored settings and shows a toast (R4.11.2, R4.11.3).
   */
  resetToDefaults(time, full = false) {
    this._muteAll(time);
    this.tiltEnabled = TILT_STARTS_ENABLED;
    this.stepBase = 0;
    this.options = { ...this.options, rangeOffset: 0 };
    this.tiltDelta = 0;
    this.tiltRef = null;
    this.emit({ type: 'action', action: 'resetSettings', full: !!full, time });
  }

  /** Updates the tilt delta (in steps) from the smoothed tilt while tilt is on. */
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

  /** The device control for logical guitar control `name` in this frame, or undefined. */
  _control(controls, name) {
    return controls[(this.options.controlNames || {})[name] || name];
  }

  _expression(controls, time) {
    let semitones = 0;
    let gain = 1;
    // The tilt only moves the range (and the strip); it never bends or changes
    // the volume. Smoothing runs whether tilt is on or off, so turning it on
    // captures a settled value as the reference.
    const tilt = this._control(controls, 'tilt');
    if (tilt) this._updateTiltSteps(this._smoothTilt(tilt.value, time));
    const whammy = this._control(controls, 'whammy'); // e.g. a gamepad in guitar mode has none
    if (whammy) {
      const d = deflection('whammy', whammy.value);
      if (this.options.whammy === 'bend') semitones = d * this.options.bendRange;
      else if (this.options.whammy === 'volume') gain = VOLUME_MIN + (1 - VOLUME_MIN) * d;
    }
    // Tilt glide follows the smoothed tilt; a pending settle (glide turned
    // off, or base changed) puts ringing notes on a whole step.
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
  }

  /** Star power trigger (R5.5): only with the option on (a device with whammy and tilt). */
  _starPower(controls, time) {
    if (!this.options.starPower) {
      // Turned off while active: end it right away.
      if (this.starPower.active) {
        this.starPower.reset();
        this.emit({ type: 'starPower', on: false, time });
      }
      return;
    }
    const tilt = this._control(controls, 'tilt');
    const whammy = this._control(controls, 'whammy');
    const change = this.starPower.update(!!tilt?.pressed, whammy ? deflection('whammy', whammy.value) : 0, time);
    if (change !== null) this.emit({ type: 'starPower', on: change, time });
  }
}
