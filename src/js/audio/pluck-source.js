// Main-thread wrapper for the Karplus-Strong AudioWorklet (design 5).
//
// The worklet module is loaded once per AudioContext. Messages sent before
// the node exists are queued, so the first strum after start-up is not lost.

import { midiToFrequency } from './theory.js';

const WORKLET_URL = new URL('./pluck-worklet.js', import.meta.url);
const modulePromises = new WeakMap();

function loadWorklet(context) {
  if (!modulePromises.has(context)) {
    if (!context.audioWorklet) {
      modulePromises.set(context, Promise.reject(new Error('AudioWorklet is not supported in this browser')));
    } else {
      modulePromises.set(context, context.audioWorklet.addModule(WORKLET_URL));
    }
  }
  return modulePromises.get(context);
}

export class PluckSource {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} destination the instrument's gain node
   * @param {{ decay: number, brightness: number }} params
   */
  constructor(context, destination, params) {
    this.context = context;
    this.params = { ...params };
    this.node = null;
    this.queue = [];
    this.disposed = false;
    this.ready = loadWorklet(context)
      .then(() => {
        if (this.disposed) return;
        this.node = new AudioWorkletNode(context, 'ks-pluck', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        this.node.connect(destination);
        for (const msg of this.queue) this.node.port.postMessage(msg);
        this.queue = [];
      })
      .catch((err) => console.error('Pluck source could not start', err));
  }

  _post(msg) {
    if (this.node) this.node.port.postMessage(msg);
    else this.queue.push(msg);
  }

  configure(params) {
    Object.assign(this.params, params);
  }

  /** `event.glide` (experiment E): start the voice that many semitones away from midi. */
  noteOn(voiceId, midi, velocity, event) {
    this._post({
      type: 'noteOn',
      id: voiceId,
      frequency: midiToFrequency(midi),
      velocity: Math.max(0, Math.min(1, velocity / 127)),
      decay: this.params.decay,
      brightness: this.params.brightness,
      ...(event?.glide ? { glide: event.glide } : {}),
    });
  }

  /** Experiment E (tilt glide): one voice's pitch offset in semitones, on top of the bend. */
  glide(voiceId, semitones) {
    this._post({ type: 'glide', id: voiceId, semitones });
  }

  noteOff(voiceId, fade) {
    this._post({ type: 'noteOff', id: voiceId, fade });
  }

  allOff(fade) {
    this._post({ type: 'allOff', fade });
  }

  bend(semitones) {
    this._post({ type: 'bend', semitones });
  }

  /** Vibrato depth in cents (0 = off); the worklet runs the LFO and adds it to the bend. */
  vibrato(cents) {
    this._post({ type: 'vibrato', cents });
  }

  dispose() {
    this.disposed = true;
    if (this.node) {
      this.node.port.postMessage({ type: 'allOff', fade: 0.05 });
      const node = this.node;
      setTimeout(() => node.disconnect(), 100);
    }
    this.node = null;
  }
}
