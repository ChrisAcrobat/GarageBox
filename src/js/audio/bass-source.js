// Generated bass sound (R3.4.1, design 5 "Bass source").
//
// A small subtractive synth from normal Web Audio nodes on the main thread.
// Each voice is a sawtooth plus a sine one octave lower (about 50 %), into a
// low-pass filter and a gain node:
//
//   saw ----\
//            +-> low-pass (cutoff sweep, the "thump") -> voice gain -> output
//   sub sine /
//
// The voice gain has a 5 ms attack, then falls 60 dB in the ring time
// (`decay`). With strum hold (R4.7.2) the level stays at its peak until
// holdEnd(). It has the same interface as PluckSource.

import { midiToFrequency } from './theory.js';

const MAX_VOICES = 24;
const ATTACK = 0.005; // s
const SUB_LEVEL = 0.5; // sine one octave down, relative to the sawtooth
const PEAK_GAIN = 0.4; // voice gain at velocity 127
const FILTER_Q = 0.7;
const THUMP_CUTOFF = 1200; // Hz at the start of a note
const THUMP_TAU = 0.08; // s, the cutoff reaches its resting value in about 0.25 s
const BEND_TAU = 0.01; // s
const GLIDE_TAU = 0.015; // s
const DROP_FADE = 0.01; // s, fade of a voice dropped by the voice limit
const SILENT_DB = 80; // a decaying voice is stopped this far below its peak
const LN_1000 = Math.log(1000);

/**
 * Resting cutoff per tone value (BRIGHTNESS_VALUES in store.js: dark 0.15,
 * warm 0.35, normal 0.55, bright 0.85 -> 250, 400, 600, 900 Hz); values in
 * between are interpolated linearly.
 */
const TONE_CUTOFFS = [
  [0.15, 250],
  [0.35, 400],
  [0.55, 600],
  [0.85, 900],
];

export function bassCutoff(brightness) {
  const b = Number.isFinite(brightness) ? brightness : 0.55;
  if (b <= TONE_CUTOFFS[0][0]) return TONE_CUTOFFS[0][1];
  for (let i = 1; i < TONE_CUTOFFS.length; i++) {
    const [b1, f1] = TONE_CUTOFFS[i];
    if (b <= b1) {
      const [b0, f0] = TONE_CUTOFFS[i - 1];
      return f0 + ((b - b0) / (b1 - b0)) * (f1 - f0);
    }
  }
  return TONE_CUTOFFS[TONE_CUTOFFS.length - 1][1];
}

export class BassSource {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} destination the instrument's gain node
   * @param {{ decay: number, brightness: number }} params
   */
  constructor(context, destination, params) {
    this.context = context;
    this.params = { ...params };
    this.output = new GainNode(context, { gain: 1 });
    this.output.connect(destination);
    /** @type {Map<number, object>} voices in start order */
    this.voices = new Map();
    this.bendSemitones = 0;
    this.disposed = false;
  }

  configure(params) {
    Object.assign(this.params, params);
  }

  _tau() {
    return Math.max(0.05, Number(this.params.decay) || 10) / LN_1000;
  }

  /**
   * `event.glide` (R4.14): start that many semitones away from midi.
   * `event.hold` (R4.7.2): the level stays at its peak until holdEnd().
   */
  noteOn(voiceId, midi, velocity, event) {
    if (this.disposed) return;
    const ctx = this.context;
    const t0 = ctx.currentTime;
    if (this.voices.has(voiceId)) this._stop(this.voices.get(voiceId), DROP_FADE);
    while (this.voices.size >= MAX_VOICES) this._stop(this.voices.values().next().value, DROP_FADE);

    const frequency = midiToFrequency(midi);
    const glide = Number(event?.glide) || 0;
    const detune = (this.bendSemitones + glide) * 100;
    const saw = new OscillatorNode(ctx, { type: 'sawtooth', frequency, detune });
    const sub = new OscillatorNode(ctx, { type: 'sine', frequency: frequency / 2, detune });
    const subGain = new GainNode(ctx, { gain: SUB_LEVEL });
    const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: THUMP_CUTOFF, Q: FILTER_Q });
    const gain = new GainNode(ctx, { gain: 0 });
    saw.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(gain).connect(this.output);

    filter.frequency.setValueAtTime(THUMP_CUTOFF, t0);
    filter.frequency.setTargetAtTime(bassCutoff(this.params.brightness), t0, THUMP_TAU);

    const peak = PEAK_GAIN * Math.max(0, Math.min(1, velocity / 127));
    const tau = this._tau();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + ATTACK);
    const voice = { id: voiceId, saw, sub, subGain, filter, gain, start: t0, peak, tau, glide, decayFrom: null, stopped: false };
    saw.start(t0);
    sub.start(t0);
    if (!event?.hold) this._decay(voice, t0 + ATTACK);
    saw.onended = () => this._disconnect(voice);
    this.voices.set(voiceId, voice);
  }

  /** Starts the ring-time decay of a voice at time t (its level is the peak there). */
  _decay(voice, t) {
    voice.decayFrom = t;
    voice.gain.gain.setTargetAtTime(0, t, voice.tau);
    const end = t + (voice.tau * SILENT_DB * Math.LN10) / 20;
    voice.saw.stop(end);
    voice.sub.stop(end);
  }

  /** Strum hold released (R4.7.2): the held voice falls 60 dB in the ring time from now. */
  holdEnd(voiceId) {
    const voice = this.voices.get(voiceId);
    if (!voice || voice.stopped || voice.decayFrom !== null) return;
    const t = Math.max(this.context.currentTime, voice.start + ATTACK);
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    // Restores the attack ramp's end if the release comes during the attack.
    g.linearRampToValueAtTime(voice.peak, t);
    this._decay(voice, t);
  }

  /** Tilt glide (R4.14): one voice's pitch offset in semitones, on top of the bend. */
  glide(voiceId, semitones) {
    const voice = this.voices.get(voiceId);
    if (!voice || voice.stopped) return;
    voice.glide = Number(semitones) || 0;
    this._setDetune(voice, GLIDE_TAU);
  }

  bend(semitones) {
    this.bendSemitones = Number(semitones) || 0;
    for (const voice of this.voices.values()) this._setDetune(voice, BEND_TAU);
  }

  _setDetune(voice, tau) {
    const cents = (this.bendSemitones + voice.glide) * 100;
    const now = this.context.currentTime;
    voice.saw.detune.setTargetAtTime(cents, now, tau);
    voice.sub.detune.setTargetAtTime(cents, now, tau);
  }

  noteOff(voiceId, fade) {
    const voice = this.voices.get(voiceId);
    if (voice) this._stop(voice, Math.max(0.001, Number(fade) || 0.08));
  }

  allOff(fade) {
    for (const voice of [...this.voices.values()]) this._stop(voice, Math.max(0.001, Number(fade) || 0.08));
  }

  /** Level of a voice's gain at time t, from its schedule (cancelAndHoldAtTime is missing in Firefox). */
  _levelAt(voice, t) {
    const age = t - voice.start;
    if (age < ATTACK) return voice.peak * Math.max(0, age / ATTACK);
    if (voice.decayFrom === null || t <= voice.decayFrom) return voice.peak;
    return voice.peak * Math.exp(-(t - voice.decayFrom) / voice.tau);
  }

  /** Linear fade to silence over `fade` s (R4.3.1), then stop and disconnect. */
  _stop(voice, fade) {
    if (voice.stopped) return;
    voice.stopped = true;
    this.voices.delete(voice.id);
    const t = this.context.currentTime;
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(this._levelAt(voice, t), t);
    g.linearRampToValueAtTime(0, t + fade);
    voice.saw.stop(t + fade + 0.01);
    voice.sub.stop(t + fade + 0.01);
  }

  _disconnect(voice) {
    voice.saw.disconnect();
    voice.sub.disconnect();
    voice.subGain.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
    if (this.voices.get(voice.id) === voice) this.voices.delete(voice.id);
  }

  dispose() {
    if (this.disposed) return;
    this.allOff(0.05);
    this.disposed = true;
    const output = this.output;
    setTimeout(() => output.disconnect(), 100);
  }
}
