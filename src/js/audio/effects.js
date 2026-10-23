// Effect presets per instrument (R3.6, design 5 "Effects").
//
// EffectChain sits between an instrument's gain node and the master gain:
//
//   input -> [send] -> drive (gain -> tanh WaveShaper, 4x oversample)
//                   -> cabinet (high-pass, peak, low-pass)
//                   -> echo (Epic only: delay with filtered feedback, mixed in)
//                   -> reverb (generated impulse response, mixed in)
//                   -> level match -> output
//
// `clean` connects the send straight to the output. setPreset() builds the
// new preset's nodes next to the old ones and crossfades the sends over a
// few milliseconds, so ringing notes keep sounding and the old preset's
// reverb or echo tail rings out before its nodes are disconnected.

/** Preset names in the order the settings offer them (R3.6). */
export const EFFECT_ORDER = Object.freeze(['clean', 'crunch', 'epic']);

/**
 * Preset parameters. `level` is the output gain that keeps a driven preset
 * about as loud as clean (measured with a 0.3 sine at 220 Hz). The numbers are
 * starting points to be tuned by ear.
 */
export const EFFECT_PRESETS = Object.freeze({
  clean: Object.freeze({}),
  crunch: Object.freeze({
    drive: 4,
    cabinet: Object.freeze({ highpass: 80, peak: 1500, peakGain: 3, lowpass: 5000 }),
    reverb: Object.freeze({ seconds: 0.8, mix: 0.15 }),
    level: 0.3,
  }),
  epic: Object.freeze({
    drive: 20,
    cabinet: Object.freeze({ highpass: 80, peak: 1500, peakGain: 4, lowpass: 4500 }),
    echo: Object.freeze({ delay: 0.375, feedback: 0.3, lowpass: 3000, mix: 0.25 }),
    reverb: Object.freeze({ seconds: 3, mix: 0.3 }),
    level: 0.25,
  }),
});

/** The WaveShaper only sees inputs in -1..1; the curve covers tanh over ±SHAPER_RANGE. */
const SHAPER_RANGE = 40;
const CROSSFADE_SECONDS = 0.01; // time constant of the send crossfade
const TAIL_MS = 3500; // an old preset's nodes are kept this long for its tail

let shaperCurve = null;
/** @type {WeakMap<BaseAudioContext, Map<number, AudioBuffer>>} */
const impulseCache = new WeakMap();

function tanhCurve() {
  if (!shaperCurve) {
    const n = 8192;
    shaperCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) shaperCurve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * SHAPER_RANGE);
  }
  return shaperCurve;
}

/** Small seeded random generator, so every impulse response is the same. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stereo decaying noise that falls 60 dB in `seconds` (cached per context). */
function impulseResponse(ctx, seconds) {
  let byLength = impulseCache.get(ctx);
  if (!byLength) impulseCache.set(ctx, (byLength = new Map()));
  let buffer = byLength.get(seconds);
  if (!buffer) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.round(seconds * rate));
    buffer = ctx.createBuffer(2, length, rate);
    const k = Math.log(1000) / (seconds * rate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      const rnd = random(0x5eed + c);
      for (let i = 0; i < length; i++) data[i] = (rnd() * 2 - 1) * Math.exp(-k * i);
    }
    byLength.set(seconds, buffer);
  }
  return buffer;
}

/** Builds one preset's nodes from `send` to `output`. Returns the nodes and their kinds. */
function buildPreset(ctx, params, send, output) {
  const nodes = [];
  const kinds = [];
  const add = (node) => (nodes.push(node), node);
  if (!params.drive) {
    send.connect(output);
    return { nodes, kinds };
  }
  // Drive
  const pre = add(new GainNode(ctx, { gain: params.drive / SHAPER_RANGE }));
  const shaper = add(new WaveShaperNode(ctx, { curve: tanhCurve(), oversample: '4x' }));
  send.connect(pre).connect(shaper);
  kinds.push('drive');
  // Cabinet
  const cab = params.cabinet;
  const hp = add(new BiquadFilterNode(ctx, { type: 'highpass', frequency: cab.highpass, Q: 0.7 }));
  const peak = add(new BiquadFilterNode(ctx, { type: 'peaking', frequency: cab.peak, Q: 0.8, gain: cab.peakGain }));
  const lp = add(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: cab.lowpass, Q: 0.7 }));
  shaper.connect(hp).connect(peak).connect(lp);
  kinds.push('cabinet');
  // Everything after the cabinet is summed here (dry + echo).
  const sum = add(new GainNode(ctx, { gain: 1 }));
  lp.connect(sum);
  if (params.echo) {
    const e = params.echo;
    const delay = add(new DelayNode(ctx, { delayTime: e.delay, maxDelayTime: Math.max(1, e.delay) }));
    const tone = add(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: e.lowpass, Q: 0.7 }));
    const feedback = add(new GainNode(ctx, { gain: e.feedback }));
    const mix = add(new GainNode(ctx, { gain: e.mix }));
    lp.connect(delay).connect(tone);
    tone.connect(feedback).connect(delay);
    tone.connect(mix).connect(sum);
    kinds.push('echo');
  }
  const level = add(new GainNode(ctx, { gain: params.level ?? 1 }));
  sum.connect(level);
  if (params.reverb) {
    const convolver = add(new ConvolverNode(ctx, { buffer: impulseResponse(ctx, params.reverb.seconds) }));
    const wet = add(new GainNode(ctx, { gain: params.reverb.mix }));
    sum.connect(convolver).connect(wet).connect(level);
    kinds.push('reverb');
  }
  level.connect(output);
  return { nodes, kinds };
}

export class EffectChain {
  /** @param {BaseAudioContext} context */
  constructor(context) {
    this.context = context;
    this.input = new GainNode(context, { gain: 1 });
    this.output = new GainNode(context, { gain: 1 });
    this.preset = null;
    this.current = null; // { send, nodes, kinds }
    this.setPreset('clean');
  }

  /** The kinds of effect the current preset uses, in chain order (e.g. ['drive', 'cabinet', 'reverb']). */
  kinds() {
    return [...(this.current?.kinds || [])];
  }

  /** Switches to a preset (unknown names give clean) without cutting ringing notes. */
  setPreset(name) {
    const preset = name in EFFECT_PRESETS ? name : 'clean';
    if (preset === this.preset) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const old = this.current;
    const first = !old;
    const send = new GainNode(ctx, { gain: first ? 1 : 0 });
    this.input.connect(send);
    const built = buildPreset(ctx, EFFECT_PRESETS[preset], send, this.output);
    if (!first) {
      send.gain.setTargetAtTime(1, now, CROSSFADE_SECONDS);
      old.send.gain.setTargetAtTime(0, now, CROSSFADE_SECONDS);
      setTimeout(() => disconnectAll(old, this.input), TAIL_MS);
    }
    this.current = { send, ...built };
    this.preset = preset;
  }

  dispose() {
    if (this.current) disconnectAll(this.current, this.input);
    this.current = null;
    this.output.disconnect();
  }
}

function disconnectAll(chain, input) {
  try {
    input.disconnect(chain.send);
  } catch {
    // already disconnected
  }
  chain.send.disconnect();
  for (const node of chain.nodes) node.disconnect();
}
