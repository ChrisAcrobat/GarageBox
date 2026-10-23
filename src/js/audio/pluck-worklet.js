// Karplus-Strong plucked string as an AudioWorklet (design 5, R3.4, R4.7).
//
// One processor per instrument; it runs one string model per voice:
//   - a short burst of filtered noise is written into a delay line whose
//     length is one period of the note (sampleRate / frequency),
//   - every sample the delay line output is fed back through a small
//     low-pass filter and a loop gain < 1, so the tone decays naturally and
//     the high harmonics die first, like a real string.
// The delay is read with linear interpolation, so pitch bend can change the
// delay length smoothly while the string rings.
//
// Messages from the main thread (pluck-source.js):
//   { type: 'noteOn', id, frequency, velocity (0..1), decay (s to -60 dB), brightness (0..1),
//     glide (semitones, optional) }
//   { type: 'glide', id, semitones }   experiment E: one voice's pitch offset
//                                      (tilt glide), smoothed over ~15 ms;
//                                      multiplied with the bend/vibrato ratio
//   { type: 'noteOff', id, fade }      linear fade to silence over `fade` s (R4.3.1)
//   { type: 'allOff', fade }
//   { type: 'bend', semitones }        applies to all voices, smoothed over ~10 ms
//   { type: 'vibrato', cents }         sine LFO (VIBRATO_RATE_HZ) on the pitch of all
//                                      voices, depth ± cents, smoothed over ~30 ms;
//                                      multiplied with the bend ratio (adds in cents)
// The processor posts { type: 'ended', id } when a voice has gone silent.

const BUFFER_SIZE = 8192; // power of two; enough for ~6 Hz at 48 kHz
const MASK = BUFFER_SIZE - 1;
const MAX_VOICES = 24;
const SILENCE = 1e-4;
const OUTPUT_GAIN = 1.2; // about as loud as the MIDI guitar at the same velocity
const VIBRATO_RATE_HZ = 5.5;
const CENTS_TO_LN = Math.LN2 / 1200;

class StringVoice {
  constructor(id, frequency, velocity, decay, brightness, bendRatio, sampleRate, glideSemitones = 0) {
    this.id = id;
    this.frequency = frequency;
    // Experiment E: per-voice glide ratio (1 = none), smoothed towards the target.
    this.glide = Math.pow(2, (glideSemitones || 0) / 12);
    this.glideTarget = this.glide;
    this.decay = Math.max(0.1, decay);
    // Two-tap loop filter weight: 0.5 = darkest (classic KS), near 0 = bright.
    this.c = 0.05 + 0.45 * (1 - Math.max(0, Math.min(1, brightness)));
    this.buf = new Float32Array(BUFFER_SIZE);
    this.w = 0;
    this.amp = 1;
    this.fadeStep = 0;
    this.quietBlocks = 0;
    this.done = false;

    // Excitation: noise, low-passed more for darker sounds, written as one period.
    const period = sampleRate / (frequency * bendRatio * this.glide);
    const length = Math.min(BUFFER_SIZE - 4, Math.ceil(period) + 2);
    const a = 0.15 + 0.85 * Math.max(0, Math.min(1, brightness));
    let y = 0;
    let mean = 0;
    const burst = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      y += a * (Math.random() * 2 - 1 - y);
      burst[i] = y;
      mean += y;
    }
    mean /= length;
    let peak = 1e-9;
    for (let i = 0; i < length; i++) {
      burst[i] -= mean; // no DC offset in the loop
      peak = Math.max(peak, Math.abs(burst[i]));
    }
    const scale = velocity / peak;
    for (let i = 0; i < length; i++) this.buf[i] = burst[i] * scale;
    this.w = length;
  }

  read(pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.buf[i & MASK];
    const b = this.buf[(i + 1) & MASK];
    return a + (b - a) * f;
  }

  /** Adds this voice into `out` for one block. */
  render(out, bendRatios, sampleRate) {
    let peak = 0;
    const c = this.c;
    // Loop gain per period so that the level falls 60 dB in `decay` seconds
    // (computed once per block; the bend changes slowly).
    const g = Math.pow(0.001, 1 / (this.decay * this.frequency * bendRatios[0] * this.glide));
    const kg = 1 - Math.exp(-1 / (0.015 * sampleRate));
    for (let n = 0; n < out.length; n++) {
      if (this.glide !== this.glideTarget) {
        this.glide += (this.glideTarget - this.glide) * kg;
        if (Math.abs(this.glideTarget - this.glide) < 1e-7) this.glide = this.glideTarget;
      }
      const f = this.frequency * bendRatios[n] * this.glide;
      const delay = sampleRate / f - c; // the loop filter adds c samples of delay
      const pos = this.w - delay;
      const y = g * ((1 - c) * this.read(pos) + c * this.read(pos - 1));
      this.buf[this.w & MASK] = y;
      this.w++;
      const s = y * this.amp;
      out[n] += s;
      const abs = s < 0 ? -s : s;
      if (abs > peak) peak = abs;
      if (this.fadeStep) {
        this.amp -= this.fadeStep;
        if (this.amp <= 0) {
          this.amp = 0;
          this.done = true;
        }
      }
    }
    if (peak < SILENCE) {
      if (++this.quietBlocks > 8) this.done = true;
    } else {
      this.quietBlocks = 0;
    }
  }

  fadeOut(seconds, sampleRate) {
    const samples = Math.max(1, seconds * sampleRate);
    this.fadeStep = Math.max(this.fadeStep, this.amp / samples);
  }
}

class PluckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.bendTarget = 1;
    this.bend = 1;
    this.bendRatios = new Float32Array(128);
    this.vibratoTarget = 0; // cents
    this.vibrato = 0; // smoothed depth in cents
    this.lfoPhase = 0; // radians
    this.dcX = 0;
    this.dcY = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    switch (msg.type) {
      case 'noteOn': {
        if (this.voices.length >= MAX_VOICES) {
          const oldest = this.voices.shift();
          this.port.postMessage({ type: 'ended', id: oldest.id });
        }
        this.voices.push(
          new StringVoice(msg.id, msg.frequency, msg.velocity, msg.decay, msg.brightness, this.bendRatios[0] || this.bend, sampleRate, msg.glide),
        );
        break;
      }
      case 'noteOff': {
        const v = this.voices.find((x) => x.id === msg.id);
        if (v) v.fadeOut(msg.fade, sampleRate);
        break;
      }
      case 'allOff':
        for (const v of this.voices) v.fadeOut(msg.fade, sampleRate);
        break;
      case 'glide': {
        const v = this.voices.find((x) => x.id === msg.id);
        if (v) v.glideTarget = Math.pow(2, (Number(msg.semitones) || 0) / 12);
        break;
      }
      case 'bend':
        this.bendTarget = Math.pow(2, msg.semitones / 12);
        break;
      case 'vibrato':
        this.vibratoTarget = Math.max(0, Number(msg.cents) || 0);
        break;
      default:
        break;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    if (this.bendRatios.length !== out.length) this.bendRatios = new Float32Array(out.length);
    // Smooth pitch bend over ~10 ms to avoid zipper noise.
    const k = 1 - Math.exp(-1 / (0.01 * sampleRate));
    // Vibrato depth is smoothed over ~30 ms so whammy steps do not click.
    const kv = 1 - Math.exp(-1 / (0.03 * sampleRate));
    const dPhase = (2 * Math.PI * VIBRATO_RATE_HZ) / sampleRate;
    for (let n = 0; n < out.length; n++) {
      this.bend += (this.bendTarget - this.bend) * k;
      this.vibrato += (this.vibratoTarget - this.vibrato) * kv;
      this.lfoPhase += dPhase;
      if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
      // Bend and vibrato combine additively in cents (ratios multiply).
      this.bendRatios[n] =
        this.vibrato > 1e-3 ? this.bend * Math.exp(this.vibrato * CENTS_TO_LN * Math.sin(this.lfoPhase)) : this.bend;
    }
    if (!this.voices.length) return true;
    for (const v of this.voices) v.render(out, this.bendRatios, sampleRate);
    for (let n = 0; n < out.length; n++) {
      // DC blocker, then output gain with a soft clip for safety.
      const x = out[n] * OUTPUT_GAIN;
      const y = x - this.dcX + 0.995 * this.dcY;
      this.dcX = x;
      this.dcY = y;
      out[n] = Math.tanh(y);
    }
    if (this.voices.some((v) => v.done)) {
      this.voices = this.voices.filter((v) => {
        if (v.done) this.port.postMessage({ type: 'ended', id: v.id });
        return !v.done;
      });
    }
    return true;
  }
}

registerProcessor('ks-pluck', PluckProcessor);
