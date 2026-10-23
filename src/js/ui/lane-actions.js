// Settings changes and toasts for lane actions (R4.15, design 4.2, 7).
//
// The guitar emits `rangeShifted` (D-pad octave) and `dpad` (D-pad effect,
// key or sound) actions; main.js turns them into stored settings changes and
// a short lane toast with these helpers. Both return { changes, toast }:
// `changes` are device settings to save ({} = nothing), `toast` the text.

import { t, noteNameList } from '../i18n/i18n.js';
import { CHOICES, getGlobalSettings } from '../settings/store.js';
import { soundCycle, DEFAULT_PROGRAMS } from '../instruments/setup.js';
import { formatSteps, signedNumber } from '../visual/simple-view.js';

/**
 * The range was moved to `base` steps (D-pad octave). Saves it as the
 * rangeOffset setting (unless `stored` already has it) and names it: "Octave
 * +1" for whole octaves of the scale, else "Range +7 steps".
 */
export function rangeShiftedChange(base, scaleLength, stored) {
  const value = Math.max(-36, Math.min(36, Math.round(base)));
  const changes = value === stored ? {} : { rangeOffset: value };
  const length = Math.max(1, scaleLength);
  const toast = value % length === 0 ? t('lane.octave', { value: signedNumber(value / length) }) : t('lane.range', { steps: formatSteps(t, value) });
  return { changes, toast };
}

/** The settings change for D-pad `action` ('effect' | 'key' | 'sound') in direction `dir` (-1 / +1). */
export function dpadChange(action, dir, settings, instrument) {
  if (action === 'effect') return effectChange(dir, settings);
  if (action === 'key') return keyChange(dir, settings);
  if (action === 'sound') return soundChange(dir, settings, instrument);
  return { changes: {}, toast: null };
}

function wrap(i, n) {
  return ((i % n) + n) % n;
}

function effectChange(dir, settings) {
  const order = CHOICES.effect;
  const i = order.indexOf(settings.effect);
  const effect = order[wrap((i < 0 ? 0 : i) + dir, order.length)];
  return { changes: { effect }, toast: t(`effect.${effect}`) };
}

function keyChange(dir, settings) {
  const root = wrap(settings.root + dir, 12);
  const note = noteNameList(getGlobalSettings().noteNames)[root];
  return { changes: { root }, toast: t('lane.key', { note }) };
}

/** The toast name of one soundCycle() entry. */
function soundName(entry, instrument) {
  if (entry.source !== 'midi') return t(`source.${entry.source}`);
  return t(`gm.${entry.program >= 0 ? entry.program : DEFAULT_PROGRAMS[instrument] ?? 0}`);
}

function soundChange(dir, settings, instrument) {
  const cycle = soundCycle(instrument);
  // 'auto' means the instrument's default source: the first sound in the cycle.
  const source = settings.source === 'auto' ? cycle[0].source : settings.source;
  // The default program counts as -1 (the instrument's default).
  const program = settings.program === DEFAULT_PROGRAMS[instrument] ? -1 : settings.program;
  const i = cycle.findIndex((e) => e.source === source && (e.source !== 'midi' || e.program === program));
  const next = i < 0 ? (dir > 0 ? cycle[0] : cycle[cycle.length - 1]) : cycle[wrap(i + dir, cycle.length)];
  // Generated sources keep the stored program, so the way back finds it again.
  const changes = next.source === 'midi' ? { source: 'midi', program: next.program } : { source: next.source };
  return { changes, toast: soundName(next, instrument) };
}
