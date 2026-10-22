// Audio engine (design section 5).
//
// One shared AudioContext (latencyHint 'interactive'). Browsers allow audio to
// start only after a click or key press (a gamepad button does not count), so
// the start screen calls unlockAudio() from such an event (7.1).
//
// Routing: every instrument gets a Channel with its own gain node (for
// 'volume' events), all channels feed one master gain and a light limiter
// (DynamicsCompressorNode) so many ringing notes do not clip:
//
//   source -> channel gain -> master gain -> limiter -> destination
//
// Each Channel also keeps a VoiceTracker: a simple per-voice level estimate
// (envelope model) on the main thread, used by the visuals to fade the
// highway trails and to show which notes ring (design 6). It works even when
// there is no audio at all.

import { PluckSource } from './pluck-source.js';
import { MidiSource } from './midi-source.js';

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

/**
 * Envelope models (levels 0..1, before channel volume):
 *   pluck: exponential decay reaching -60 dB after `decay` seconds (R4.7)
 *   sustained: slow decay while held (MIDI melodic instruments)
 *   oneShot: short decay, no note-off needed (drums)
 * After a noteOff the level additionally falls linearly to 0 over `fade`.
 */
export class VoiceTracker {
  constructor({ model = 'pluck', decay = 4, release = 0.3 } = {}) {
    this.configure({ model, decay, release });
    /** @type {Map<number, {voiceId:number, midi:number, column:number, start:number, peak:number, offAt:number|null, fade:number, oneShot:boolean}>} */
    this.voices = new Map();
    this.gain = 1;
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
    });
  }

  noteOff(e, now) {
    const v = this.voices.get(e.voiceId);
    if (!v || v.offAt !== null) return;
    v.offAt = now;
    v.fade = this.model === 'pluck' ? Math.max(0.001, e.fade ?? 0.08) : this.release;
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
    if (v.oneShot || this.model === 'oneShot') env = Math.pow(0.001, age / 0.6);
    else if (this.model === 'sustained') env = Math.pow(0.001, age / 12);
    else env = Math.pow(0.001, age / this.decay);
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
   * @param {{source:'pluck'|'midi', model:'pluck'|'sustained'|'oneShot', decay?:number,
   *   brightness?:number, drums?:boolean, program?:number, bendRange?:number}} config
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
      this.gainNode.connect(this.engine.master);
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
      case 'noteOff':
        t.noteOff(event, now);
        this.source?.noteOff(event.voiceId, event.fade);
        break;
      case 'bend':
        this.source?.bend(event.semitones);
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
      setTimeout(() => node.disconnect(), 200);
    }
    this.gainNode = null;
    this.engine.channels.delete(this);
  }
}

/** Sources are rebuilt only when this key changes; other changes go to source.configure(). */
function sourceKey(config) {
  return `${config.source}:${config.drums ? 'drums' : 'melodic'}`;
}

function trackerConfig(config) {
  return { model: config.model || 'pluck', decay: config.decay || 4 };
}

function createSource(ctx, destination, config) {
  switch (config.source) {
    case 'pluck':
      return new PluckSource(ctx, destination, config);
    case 'midi':
      return new MidiSource(ctx, destination, config);
    default:
      console.warn(`Unknown sound source "${config.source}"`);
      return null;
  }
}
