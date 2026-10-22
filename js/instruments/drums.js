// Drums (design 4.3, R4b).
//
// Each logical control maps to a General MIDI drum note (played on MIDI
// channel 10). Digital buttons hit with a fixed velocity. Analog controls
// (the triggers) hit when they pass TRIGGER_ON, with a velocity from how far
// they are pressed at that moment, and re-arm when they fall below
// TRIGGER_OFF (R4b.1). Drum notes are one-shot: only noteOn, the sound ends by
// itself. Start opens the settings panel (as on the guitar).

import { Instrument, newVoiceId } from './instrument.js';
import { ANALOG_CONTROLS } from '../input/mappings.js';

/** General MIDI drum notes offered in the settings (R4b.2). 0 = no sound. */
export const DRUM_NOTES = Object.freeze([
  0, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 75, 76, 77,
]);

/**
 * Default mapping (R4b.1): face buttons kick, snare, hi-hat, tom; shoulders
 * crash and ride; triggers open hi-hat and high tom (velocity sensitive);
 * D-pad two more toms, clap and cowbell. A guitar controller set to drums
 * plays the drum kit on its frets and strum bar.
 */
export const DEFAULT_DRUM_MAP = Object.freeze({
  faceA: 36, // bass drum (kick)
  faceB: 38, // snare
  faceX: 42, // closed hi-hat
  faceY: 45, // low tom
  shoulderL: 49, // crash cymbal
  shoulderR: 51, // ride cymbal
  triggerL: 46, // open hi-hat
  triggerR: 50, // high tom
  dpadUp: 48, // hi-mid tom
  dpadDown: 41, // low floor tom
  dpadLeft: 39, // hand clap
  dpadRight: 56, // cowbell
  fret1: 36,
  fret2: 38,
  fret3: 42,
  fret4: 45,
  fret5: 49,
  strumUp: 51,
  strumDown: 46,
});

export const DIGITAL_VELOCITY = 100;
export const TRIGGER_ON = 0.2;
export const TRIGGER_OFF = 0.1;
const MIN_VELOCITY = 30;

/** Velocity 30..127 for an analog control that just passed TRIGGER_ON with `value`. */
export function triggerVelocity(value) {
  const x = Math.max(0, Math.min(1, (value - TRIGGER_ON) / (1 - TRIGGER_ON)));
  return Math.round(MIN_VELOCITY + (127 - MIN_VELOCITY) * x);
}

export class Drums extends Instrument {
  /**
   * @param {{ map?: Record<string, number>, controls?: string[] }} options
   *   map: control name -> GM drum note (0 = none); controls: the device's
   *   logical control names in display order (defines the pads/columns).
   */
  constructor(options = {}) {
    super();
    this.armed = {};
    this.configure(options);
  }

  configure(options = {}) {
    this.options = { ...this.options, ...options };
    const map = { ...DEFAULT_DRUM_MAP, ...(this.options.map || {}) };
    const names = this.options.controls || Object.keys(map);
    const old = new Map((this.pads || []).map((p) => [p.control, p]));
    /** One pad per mapped control: { control, note, lastHit, velocity } */
    this.pads = names
      .filter((name) => map[name])
      .map((name) => ({ control: name, note: map[name], lastHit: old.get(name)?.lastHit ?? -Infinity, velocity: old.get(name)?.velocity ?? 0 }));
    this.padIndex = new Map(this.pads.map((p, i) => [p.control, i]));
  }

  process(edges, controls, time) {
    for (const e of edges) {
      if (e.name === 'start' && e.type === 'pressed') {
        this.emit({ type: 'action', action: 'openSettings', time });
        continue;
      }
      const i = this.padIndex.get(e.name);
      if (i === undefined) continue;
      if (ANALOG_CONTROLS.has(e.name)) {
        // Analog: threshold with hysteresis, velocity from the value at the crossing.
        if (this.armed[e.name] !== false && e.value >= TRIGGER_ON) {
          this.armed[e.name] = false;
          this._hit(i, triggerVelocity(e.value), time);
        } else if (e.value < TRIGGER_OFF) {
          this.armed[e.name] = true;
        }
      } else if (e.type === 'pressed') {
        this._hit(i, DIGITAL_VELOCITY, time);
      }
    }
  }

  _hit(i, velocity, time) {
    const pad = this.pads[i];
    pad.lastHit = time;
    pad.velocity = velocity;
    this.emit({ type: 'noteOn', voiceId: newVoiceId(), midi: pad.note, velocity, time, column: i, oneShot: true });
  }
}
