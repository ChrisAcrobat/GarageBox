// MIDI-style sound source: wraps the vendored webaudio-tinysynth (design 5, R3.3).
//
// webaudio-tinysynth is a classic script (an IIFE that sets
// window.WebAudioTinySynth), not an ES module, so it is loaded once with a
// <script> element on first use. No build step is involved.
//
// Each MidiSource owns one synth instance and uses one MIDI channel on it
// (channel 10 = index 9 for drums, channel 1 = index 0 otherwise). A separate
// instance per instrument lets the synth's output go into the instrument's own
// gain node, so 'volume' events work like for every other source. Instances
// are pooled and reused when an instrument is replaced.
//
// By default the library creates its own AudioContext. The subclass below
// turns that off (the `internalcontext` property), and the shared context is
// passed in with setAudioContext(context, destination) instead, so audio
// starts with the same click as everything else (design 5, 7.1).

const SCRIPT_URL = new URL('../../vendor/webaudio-tinysynth/webaudio-tinysynth.js', import.meta.url);
const DRUM_CHANNEL = 9;

let scriptPromise = null;
let EmbeddedSynth = null;
const pool = new WeakMap(); // AudioContext -> free synth instances

/** Loads the vendored library once and returns a subclass that uses an external AudioContext. */
export function loadTinySynth() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      if (window.WebAudioTinySynth) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = SCRIPT_URL.href;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load ${SCRIPT_URL.href}`));
      document.head.append(script);
    }).then(() => {
      const Base = window.WebAudioTinySynth;
      if (!Base) throw new Error('webaudio-tinysynth did not define WebAudioTinySynth');
      EmbeddedSynth = class extends Base {};
      // Ignore the library's default internalcontext = 1 (it would create a second AudioContext).
      Object.defineProperty(EmbeddedSynth.prototype, 'internalcontext', {
        get: () => 0,
        set: () => {},
        configurable: true,
      });
      return EmbeddedSynth;
    });
  }
  return scriptPromise;
}

function takeSynth(context, destination) {
  const free = pool.get(context) || [];
  pool.set(context, free);
  let synth = free.pop();
  if (!synth) {
    synth = new EmbeddedSynth({ useReverb: 1, quality: 1 });
    synth.setAudioContext(context, destination);
  } else {
    synth.comp.connect(destination);
  }
  return synth;
}

function returnSynth(context, synth, destination) {
  for (let ch = 0; ch < 16; ch++) synth.allSoundOff(ch);
  try {
    synth.comp.disconnect(destination);
  } catch {
    // already disconnected
  }
  pool.get(context)?.push(synth);
}

export class MidiSource {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} destination the instrument's gain node
   * @param {{ drums?: boolean, program?: number, bendRange?: number }} params
   */
  constructor(context, destination, params) {
    this.context = context;
    this.destination = destination;
    this.params = { drums: false, program: 0, bendRange: 2, ...params };
    this.channel = this.params.drums ? DRUM_CHANNEL : 0;
    this.synth = null;
    this.queue = [];
    this.voices = new Map(); // voiceId -> MIDI note
    this.disposed = false;
    this.ready = loadTinySynth()
      .then(() => {
        if (this.disposed) return;
        this.synth = takeSynth(context, destination);
        this._applyParams();
        for (const fn of this.queue) fn();
        this.queue = [];
      })
      .catch((err) => console.error('MIDI source could not start', err));
  }

  _do(fn) {
    if (this.synth) fn();
    else this.queue.push(fn);
  }

  _send(msg) {
    this._do(() => this.synth.send(msg));
  }

  _applyParams() {
    const s = this.synth;
    if (!s) return;
    if (!this.params.drums) {
      s.send([0xc0 | this.channel, this.params.program & 127]);
      // Pitch bend range in semitones, so 'bend' events map 1:1 to semitones.
      // (The library converts its range value to cents as value * 100 / 127.)
      s.setBendRange(this.channel, Math.max(1, Math.min(24, Math.abs(this.params.bendRange))) * 127);
    }
  }

  configure(params) {
    Object.assign(this.params, params);
    this._do(() => this._applyParams());
  }

  noteOn(voiceId, midi, velocity) {
    const note = Math.max(0, Math.min(127, Math.round(midi)));
    this.voices.set(voiceId, note);
    this._send([0x90 | this.channel, note, Math.max(1, Math.min(127, Math.round(velocity)))]);
    // Drum notes end by themselves (design 4.3); forget them right away.
    if (this.params.drums) this.voices.delete(voiceId);
  }

  noteOff(voiceId) {
    const note = this.voices.get(voiceId);
    if (note === undefined) return;
    this.voices.delete(voiceId);
    // Another voice may still play the same note (e.g. a key pressed again while sustained).
    if ([...this.voices.values()].includes(note)) return;
    this._send([0x80 | this.channel, note, 0]);
  }

  allOff() {
    for (const id of [...this.voices.keys()]) this.noteOff(id);
  }

  bend(semitones) {
    if (this.params.drums) return;
    const range = Math.max(1, Math.abs(this.params.bendRange));
    const value = Math.max(0, Math.min(16383, Math.round(8192 + (8192 * semitones) / range)));
    this._send([0xe0 | this.channel, value & 127, value >> 7]);
  }

  dispose() {
    this.disposed = true;
    if (this.synth) returnSynth(this.context, this.synth, this.destination);
    this.synth = null;
    this.queue = [];
  }
}
