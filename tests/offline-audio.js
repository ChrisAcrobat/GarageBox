// Offline rendering helpers shared by the sound test pages (pluck, bass,
// effects; design 9.2). Everything renders in an OfflineAudioContext, so the
// pages need no audio device and run the same in a headless browser.

export const RATE = 48000;

/** RMS of `data` between two times in seconds. */
export function rms(data, from, to) {
  let sum = 0;
  const a = Math.floor(from * RATE);
  const b = Math.min(data.length, Math.floor(to * RATE));
  for (let i = a; i < b; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, b - a));
}

/** Level in dB (RMS) between two times; -Infinity for silence. */
export function db(data, from, to) {
  return 20 * Math.log10(rms(data, from, to));
}

/** Largest absolute sample. */
export function peak(data) {
  let p = 0;
  for (const v of data) p = Math.max(p, Math.abs(v));
  return p;
}

/** Estimates the fundamental frequency (30-1000 Hz) by autocorrelation. */
export function frequency(data, from, to, { min = 50, max = 1000 } = {}) {
  const a = Math.floor(from * RATE);
  const n = Math.min(Math.floor((to - from) * RATE), 8192);
  let best = 0;
  let bestLag = 1;
  for (let lag = Math.floor(RATE / max); lag <= Math.ceil(RATE / min); lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += data[a + i] * data[a + i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return RATE / bestLag;
}

/** First-difference energy relative to the signal: a rough "high content" measure. */
export function brightness(data, from, to) {
  const a = Math.floor(from * RATE);
  const b = Math.floor(to * RATE);
  let diff = 0;
  let sig = 0;
  for (let i = a + 1; i < b; i++) {
    diff += (data[i] - data[i - 1]) ** 2;
    sig += data[i] * data[i];
  }
  return sig ? Math.sqrt(diff / sig) : 0;
}

/**
 * Seconds a decaying signal needs to fall 60 dB, from the slope between two
 * windows (each 50 ms wide, starting at t1 and t2).
 */
export function timeTo60dB(data, t1, t2) {
  const drop = db(data, t1, t1 + 0.05) - db(data, t2, t2 + 0.05);
  return drop > 0 ? (60 * (t2 - t1)) / drop : Infinity;
}

/**
 * Renders `seconds` of mono audio with a source created by
 * `make(ctx, destination)` (it may return a promise or have a `ready`
 * promise). `steps` is a list of [time, fn(source, ctx)]: rendering is
 * suspended at each time, fn runs, and rendering resumes after a short wait
 * (so a worklet has received its messages). An error in fn never stops the
 * rendering: it is collected in `errors` and rendering goes on.
 * Returns { data, errors }.
 */
export async function render(seconds, make, steps = []) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const source = await make(ctx, ctx.destination);
  if (source?.ready) await source.ready;
  const errors = [];
  const wait = () => new Promise((r) => setTimeout(r, 30));
  // One suspend per distinct render quantum (two suspends at the same time are an error).
  const byTime = new Map();
  for (const [time, fn] of steps) {
    const key = Math.floor((time * RATE) / 128) * 128 / RATE;
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key).push(fn);
  }
  for (const [time, fns] of byTime) {
    ctx.suspend(time).then(async () => {
      for (const fn of fns) {
        try {
          fn(source, ctx);
        } catch (err) {
          errors.push(String(err));
        }
      }
      await wait();
      ctx.resume();
    });
  }
  const data = (await ctx.startRendering()).getChannelData(0);
  return { data, errors };
}

/** Amplitude of one frequency between two times (Goertzel); about the sine amplitude for a pure tone. */
export function toneLevel(data, from, to, freq) {
  const a = Math.floor(from * RATE);
  const b = Math.min(data.length, Math.floor(to * RATE));
  const w = (2 * Math.PI * freq) / RATE;
  let re = 0;
  let im = 0;
  for (let i = a; i < b; i++) {
    re += data[i] * Math.cos(w * i);
    im -= data[i] * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / Math.max(1, b - a);
}
