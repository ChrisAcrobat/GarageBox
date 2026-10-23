// Audio engine (design section 5).
//
// One shared AudioContext (latencyHint 'interactive'). Browsers allow audio to
// start only after a click or key press (a gamepad button does not count), so
// the start screen calls unlockAudio() from such an event (7.1).
//
// Routing: every instrument gets a Channel with its own gain node (for
// 'volume' events) and, for melodic instruments, an effect chain (R3.6,
// effects.js); all channels feed one master gain and a light limiter
// (DynamicsCompressorNode) so many ringing notes do not clip:
//
//   source -> channel gain -> effect chain -> master gain -> limiter -> destination
//
// Each Channel also keeps a VoiceTracker: a simple per-voice level estimate
// (envelope model) on the main thread, used by the visuals to fade the
// highway trails and to show which notes ring (design 6). It works even when
// there is no audio at all.

import { PluckSource } from './pluck-source.js';
import { MidiSource } from './midi-source.js';
import { BassSource } from './bass-source.js';
import { EffectChain } from './effects.js';

let context = null;
let engine = null;

/** Returns the shared AudioContext, or null before unlockAudio() was called. */
export function getAudioContext() {
  return context;
}

/**
 * Creates the AudioContext if needed and resumes it. Must be called from a
 * click or key press handler. Resolves to the context (or null if Web Audio
 * is unavailable).
 */
export async function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('Web Audio API is not available in this browser.');
    return null;
  }
  if (!context) {
    context = new AudioContextClass({ latencyHint: 'interactive' });
    getEngine().attach(context);
  }
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (err) {
      console.warn('Could not resume the AudioContext', err);
    }
  }
  return context;
}

/**
 * Resumes the context again on later clicks or key presses, in case the
 * browser suspended it (e.g. after the tab was in the background).
 */
export function keepAudioAlive() {
  const resume = () => {
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', resume, true);
  window.addEventListener('keydown', resume, true);
}

/** The page-wide engine (created on first use, gets its context from unlockAudio()). */
export function getEngine() {
  if (!engine) engine = new AudioEngine();
  return engine;
}

// ---------------------------------------------------------------------------
// Level model for the visuals

/** A voice counts as silent below this level and is dropped. */
export const SILENT_LEVEL = 0.02;

/** Seconds a decaying MIDI voice takes to fall 60 dB in the level model (R4.7.1). */
const MIDI_DECAY_SECONDS = 12;
/** Seconds a drum hit takes to fall 60 dB in the level model. */
const DRUM_DECAY_SECONDS = 0.6;
/** Release of a MIDI voice after noteOff in the level model, before the fade (R4.7.1). */
const MIDI_RELEASE_SECONDS = 0.3;

/**
 * General MIDI programs (0-based) whose notes sound as long as they are held
 * (R4.7.1): organs, bowed strings and ensembles, brass, reeds, pipes, synth
 * leads and pads. Pizzicato strings (45), harp (46), timpani (47) and
 * orchestra hit (55) decay like plucked or struck sounds.
 */
export function isSustainingProgram(program) {
  const p = Number(program) || 0;
  if (p >= 16 && p <= 23) return true; // organs, accordion, harmonica
  if (p >= 40 && p <= 44) return true; // violin .. tremolo strings
  if (p >= 48 && p <= 54) return true; // ensembles, synth strings, choir, voice
  return p >= 56 && p <= 95; // brass, reeds, pipes, synth leads, synth pads
}

/**
 * Level model of a channel's sound configuration (design 5 "Tracker"):
 *   pluck: plucked string and bass sources, -60 dB in the ring time `decay`
 *   sustained: MIDI programs that sustain (full level until noteOff)
 *   decaying: other MIDI melodic programs (-60 dB after 12 s)
 *   oneShot: drums
 */
export function trackerConfig(sound = {}) {
  if (sound.drums || sound.model === 'oneShot') return { model: 'oneShot' };
  if (sound.source === 'midi') {
    return { model: isSustainingProgram(sound.program) ? 'sustained' : 'decaying', release: MIDI_RELEASE_SECONDS };
  }
  return { model: 'pluck', decay: sound.decay || 10 };
}

/**
 * Per-voice level estimate (levels 0..1, before channel volume), see
 * trackerConfig() for the models. A pluck voice started with `hold`
 * (strum hold, R4.7.2) stays at its peak until holdEnd(), then decays from
 * there. After a noteOff the level additionally falls linearly to 0 over
 * the note's fade (pluck) or the release plus the fade (MIDI).
 */
export class VoiceTracker {
  constructor({ model = 'pluck', decay = 10, release = MIDI_RELEASE_SECONDS } = {}) {
    this.configure({ model, decay, release });
    /** @type {Map<number, {voiceId:number, midi:number, column:number, start:number, peak:number, offAt:number|null, fade:number, oneShot:boolean, hold:boolean, holdEndAt:number|null}>} */
    this.voices = new Map();
    this.gain = 1;
    /** Current pitch bend in semitones (shown as trail width, R5.4.5). */
    this.bend = 0;
  }

  configure({ model, decay, release } = {}) {
    if (model) this.model = model;
    if (decay) this.decay = decay;
    if (release) this.release = release;
  }

  noteOn(e, now) {
    this.voices.set(e.voiceId, {
      voiceId: e.voiceId,
      midi: e.midi,
      column: e.column ?? 0,
      start: now,
      peak: Math.max(0.15, (e.velocity ?? 100) / 127),
      offAt: null,
      fade: 0,
      oneShot: !!e.oneShot,
      hold: !!e.hold,
      holdEndAt: null,
    });
  }

  /** Strum released (R4.7.2): a held pluck voice starts its decay at `now`. */
  holdEnd(e, now) {
    const v = this.voices.get(e.voiceId);
    if (v && v.hold && v.holdEndAt === null) v.holdEndAt = Math.max(now, v.start);
  }

  noteOff(e, now) {
    const v = this.voices.get(e.voiceId);
    if (!v || v.offAt !== null) return;
    v.offAt = now;
    const fade = Math.max(0.001, e.fade ?? 0.08);
    v.fade = this.model === 'pluck' ? fade : this.release + fade;
  }

  allOff(now, fade) {
    for (const v of this.voices.values()) this.noteOff({ voiceId: v.voiceId, fade }, now);
  }

  /** Level 0..1 of one voice at time `now` (seconds), including channel volume. */
  level(voiceId, now) {
    const v = this.voices.get(voiceId);
    if (!v) return 0;
    return this._envelope(v, now) * this.gain;
  }

  /** Level of a voice without the channel volume. */
  _envelope(v, now) {
    const age = Math.max(0, now - v.start);
    let env;
    if (v.oneShot || this.model === 'oneShot') env = Math.pow(0.001, age / DRUM_DECAY_SECONDS);
    else if (this.model === 'sustained') env = 1;
    else if (this.model === 'decaying') env = Math.pow(0.001, age / MIDI_DECAY_SECONDS);
    else if (v.hold) {
      // Held until holdEnd (or until the note is stopped), then the ring-time decay.
      const from = v.holdEndAt ?? now;
      env = Math.pow(0.001, Math.max(0, now - from) / this.decay);
    } else env = Math.pow(0.001, age / this.decay);
    if (v.offAt !== null) env *= Math.max(0, 1 - (now - v.offAt) / v.fade);
    return env * v.peak;
  }

  /** Removes silent voices. Returns the remaining voices with their level. */
  active(now) {
    const out = [];
    for (const [id, v] of this.voices) {
      // Checked without the channel volume, so a quiet volume does not drop voices.
      const env = this._envelope(v, now);
      if (env < SILENT_LEVEL) this.voices.delete(id);
      else out.push({ ...v, level: env * this.gain });
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Engine and channels

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.channels = new Set();
  }

  /** Builds the master chain on `ctx` and connects channels created earlier. */
  attach(ctx) {
    this.context = ctx;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    for (const ch of this.channels) ch._build();
  }

  /**
   * Creates a channel for one instrument (or one part of an instrument).
   * @param {{source:'pluck'|'bass'|'midi', model?:'oneShot', decay?:number,
   *   brightness?:number, drums?:boolean, program?:number, bendRange?:number,
   *   effect?:string}} config
   */
  createChannel(config) {
    const ch = new Channel(this, config);
    this.channels.add(ch);
    return ch;
  }
}

export class Channel {
  constructor(engine, config) {
    this.engine = engine;
    this.config = { ...config };
    this.tracker = new VoiceTracker(trackerConfig(this.config));
    this.gainNode = null;
    this.effects = null; // EffectChain, not for drums (R3.6)
    this.source = null;
    this.disposed = false;
    if (engine.context) this._build();
  }

  _build() {
    if (this.disposed || !this.engine.context) return;
    const ctx = this.engine.context;
    if (!this.gainNode) {
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.tracker.gain;
      if (this.config.drums) {
        this.gainNode.connect(this.engine.master);
      } else {
        this.effects = new EffectChain(ctx);
        this.effects.setPreset(this.config.effect || 'clean');
        this.gainNode.connect(this.effects.input);
        this.effects.output.connect(this.engine.master);
      }
    }
    this.source?.dispose();
    this.source = createSource(ctx, this.gainNode, this.config);
  }

  /** Applies a new configuration; rebuilds the source when its type changed. */
  configure(config) {
    const old = this.config;
    this.config = { ...old, ...config };
    this.tracker.configure(trackerConfig(this.config));
    if (!this.engine.context) return;
    if (this.effects && this.effects.preset !== (this.config.effect || 'clean')) {
      this.effects.setPreset(this.config.effect || 'clean');
    }
    if (!this.source || sourceKey(old) !== sourceKey(this.config)) this._build();
    else this.source.configure(this.config);
  }

  /** Sends one note event (design 4.1) to the audio source and the level model. */
  handle(event, now) {
    const t = this.tracker;
    switch (event.type) {
      case 'noteOn':
        t.noteOn(event, now);
        this.source?.noteOn(event.voiceId, event.midi, event.velocity, event);
        break;
      case 'holdEnd': // strum released (R4.7.2)
        t.holdEnd(event, now);
        this.source?.holdEnd?.(event.voiceId);
        break;
      case 'noteOff':
        t.noteOff(event, now);
        this.source?.noteOff(event.voiceId, event.fade);
        break;
      case 'bend':
        t.bend = event.semitones;
        this.source?.bend(event.semitones);
        break;
      case 'glide': // tilt glide (R4.14): per-voice pitch offset
        this.source?.glide?.(event.voiceId, event.semitones);
        break;
      case 'volume':
        t.gain = event.gain;
        if (this.gainNode) {
          const ctx = this.engine.context;
          this.gainNode.gain.setTargetAtTime(event.gain, ctx.currentTime, 0.02);
        }
        break;
      default:
        break;
    }
  }

  /** Stops every voice with `fade` seconds (used when an instrument is replaced). */
  allOff(now, fade = 0.08) {
    this.tracker.allOff(now, fade);
    this.source?.allOff(fade);
  }

  dispose() {
    this.disposed = true;
    this.source?.dispose();
    this.source = null;
    if (this.gainNode) {
      const node = this.gainNode;
      const effects = this.effects;
      // After the voices' fade (and a short part of an effect tail).
      setTimeout(() => {
        node.disconnect();
        effects?.dispose();
      }, 200);
    }
    this.gainNode = null;
    this.effects = null;
    this.engine.channels.delete(this);
  }
}

/** Sources are rebuilt only when this key changes; other changes go to source.configure(). */
function sourceKey(config) {
  return `${config.source}:${config.drums ? 'drums' : 'melodic'}`;
}

function createSource(ctx, destination, config) {
  switch (config.source) {
    case 'pluck':
      return new PluckSource(ctx, destination, config);
    case 'bass':
      return new BassSource(ctx, destination, config);
    case 'midi':
      return new MidiSource(ctx, destination, config);
    default:
      console.warn(`Unknown sound source "${config.source}"`);
      return null;
  }
}
