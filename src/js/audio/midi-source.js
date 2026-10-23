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
//
// Experiment E, tilt glide: the guitar sends a per-voice pitch offset
// ('glide' events, and `glide` on noteOn). It is NOT sent as MIDI pitch bend
// (that is one value per channel and limited to the bend range, while a chord
// glides by different amounts per string and the offset can be several
// semitones). Instead each voice's oscillators get it as extra detune (cents)
// on top of the channel bend: detune = channel bend + glide. The synth's own
// bend handling resets detune to the channel bend, so after every bend the
// glide is added again. So there is no bend-range limit for the glide, and
// the whammy bend still uses its configured range unchanged.

const SCRIPT_URL = new URL('../../vendor/webaudio-tinysynth/webaudio-tinysynth.js', import.meta.url);
const DRUM_CHANNEL = 9;
/** Vibrato rate (experiment B); the synth's own modulation LFO is set to this. */
const VIBRATO_RATE_HZ = 5.5;

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
    // Experiment E: voiceId -> { nt (the synth's note entry), cents (glide) },
    // kept through the release tail until the synth drops the note.
    this.glides = new Map();
    this.vibratoCents = 0;
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

  noteOn(voiceId, midi, velocity, event) {
    const note = Math.max(0, Math.min(127, Math.round(midi)));
    this.voices.set(voiceId, note);
    const msg = [0x90 | this.channel, note, Math.max(1, Math.min(127, Math.round(velocity)))];
    const glide = Number(event?.glide) || 0;
    this._do(() => {
      this.synth.send(msg);
      if (this.params.drums) return;
      // Experiment E: remember the synth's note entry for per-voice detune.
      this._pruneGlides();
      const tab = this.synth.notetab || [];
      const nt = tab[tab.length - 1];
      if (!nt || nt.ch !== this.channel || nt.n !== note) return;
      const entry = { nt, cents: glide * 100 };
      this.glides.set(voiceId, entry);
      if (entry.cents) this._applyGlide(entry, true);
    });
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
    // Experiment E: the synth set every note's detune to the channel bend; add the glides again.
    this._do(() => {
      if (!this.glides.size) return;
      this._pruneGlides();
      for (const entry of this.glides.values()) if (entry.cents) this._applyGlide(entry, true);
    });
  }

  /** Experiment E (tilt glide): one voice's pitch offset in semitones, on top of the bend. */
  glide(voiceId, semitones) {
    if (this.params.drums) return;
    this._do(() => {
      const entry = this.glides.get(voiceId);
      if (!entry) return;
      entry.cents = (Number(semitones) || 0) * 100;
      this._applyGlide(entry, false);
    });
  }

  /** Current detune of a voice in cents (channel bend + glide), for tests and smoke checks. */
  voiceDetune(voiceId) {
    const entry = this.glides.get(voiceId);
    const o = entry?.nt.o.find((x) => x.frequency && x.detune);
    return o ? o.detune.value : null;
  }

  /** detune = channel bend + glide on the voice's pitched oscillators (immediately or over ~15 ms). */
  _applyGlide(entry, immediate) {
    const s = this.synth;
    const value = (s.bend?.[this.channel] || 0) + entry.cents;
    const now = this.context.currentTime;
    for (const o of entry.nt.o) {
      if (!o.frequency || !o.detune) continue; // like the synth's own bend: pitched oscillators only
      o.detune.cancelScheduledValues(now);
      if (immediate) o.detune.setValueAtTime(value, now);
      else o.detune.setTargetAtTime(value, now, 0.015);
    }
  }

  /** Forgets glide entries of notes the synth has dropped. */
  _pruneGlides() {
    if (!this.glides.size) return;
    const live = new Set(this.synth.notetab || []);
    for (const [id, entry] of this.glides) if (!live.has(entry.nt)) this.glides.delete(id);
  }

  /**
   * Vibrato depth in cents (0 = off). Uses the synth's built-in modulation
   * path: one sine LFO per synth instance -> a gain node per channel -> the
   * detune of every oscillator of that channel (also notes started later).
   * The bend sets the detune value itself, so the two add up in cents. The
   * depth is ramped (setTargetAtTime) to avoid zipper noise.
   */
  vibrato(cents) {
    if (this.params.drums) return;
    this.vibratoCents = Math.max(0, Number(cents) || 0);
    this._do(() => {
      const s = this.synth;
      if (s.lfo) s.lfo.frequency.value = VIBRATO_RATE_HZ;
      const g = s.chmod?.[this.channel]?.gain;
      if (g) g.setTargetAtTime(this.vibratoCents, this.context.currentTime, 0.03);
    });
  }

  dispose() {
    this.disposed = true;
    if (this.synth && this.vibratoCents) {
      const g = this.synth.chmod?.[this.channel]?.gain;
      if (g) {
        g.cancelScheduledValues(0);
        g.value = 0;
      }
    }
    this.glides.clear();
    if (this.synth) returnSynth(this.context, this.synth, this.destination);
    this.synth = null;
    this.queue = [];
  }
}
