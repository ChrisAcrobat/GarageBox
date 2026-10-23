// Settings store (design section 8, R2.7).
//
// Defaults live in one object. User changes are saved in localStorage:
// global settings under one key, per-device settings in one object keyed by
// gamepad.id. Unknown or invalid stored values fall back to the defaults, so
// adding new settings never breaks old saved data.

// Experiment E: own keys (suffix "-expE"), so settings saved by the main app
// (or another experiment) do not override this variant's defaults.
const GLOBAL_KEY = 'musicSandbox.global-expE';
const DEVICES_KEY = 'musicSandbox.devices-expE';

/** Default values. Every setting must have one. */
export const DEFAULTS = Object.freeze({
  global: Object.freeze({
    // 'auto' = use navigator.language, otherwise a language code ('en', 'sv').
    language: 'auto',
    // The computer keyboard as an extra instrument is hidden by default (R4c.2).
    keyboard: false,
    // Visual style of all lanes (R5.2): 'highway' or 'simple'.
    view: 'highway',
  }),
  device: Object.freeze({
    // 'auto' = use the instrument implied by controller type detection (R2.2, R2.3).
    // Any other value is a manual choice and always wins (R2.6, R2.7).
    instrument: 'auto',
    // Key (root pitch class, 0 = C ... 4 = E ... 11 = B) and scale (R4.9).
    root: 4,
    scale: 'minorPentatonic',
    // Mute fade-out in milliseconds (R4.3.1, R4.11).
    fadeMs: 80,
    // Plucked string: seconds until a note has died away (R4.7), and tone color.
    decay: 4,
    brightness: 'normal',
    // Sound source: 'auto' = the instrument's default (R3.5), or 'pluck' / 'midi'.
    source: 'auto',
    // General MIDI program 0-127 for the MIDI source, -1 = the instrument's default.
    program: -1,
    // Whammy and tilt assignment (R4.5): 'bend' | 'volume' | 'vibrato' | 'off'.
    // Experiment E defaults: whammy = pitch bend, tilt = off (no sound effect;
    // with Back, tilt shifts the fret range by scale steps instead).
    whammy: 'bend',
    tilt: 'off',
    // Pitch bend at full deflection, in semitones (negative = down).
    bendRange: -2,
    // Tilt smoothing time constant in ms, 0 = off (R4.5.1, design 4.2).
    tiltSmoothing: 80,
    // Experiment E: the guitar's locked fret-range offset in scale steps (the
    // base that Back locks when tilt is turned off). Saved per device, so it
    // survives a reload; reset to 0 with the other settings. Tilt on/off is
    // not saved (always off after a reload).
    rangeOffset: 0,
    // Experiment E: while tilt is on, the pitch glides continuously between
    // scale steps (the same fractional offset as the note strip) instead of
    // moving in whole steps. Off by default; reset with the other settings.
    tiltGlide: false,
    // Drums: control name -> General MIDI drum note (0 = none). Missing entries use the defaults.
    drumMap: Object.freeze({}),
  }),
});

/** Allowed values for settings that are enumerations. */
export const CHOICES = Object.freeze({
  view: Object.freeze(['highway', 'simple']),
  instrument: Object.freeze(['auto', 'guitar', 'drums', 'bass']),
  root: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  scale: Object.freeze(['minorPentatonic', 'majorPentatonic', 'blues', 'major', 'minor']),
  fadeMs: Object.freeze([20, 40, 80, 150, 300, 600]),
  decay: Object.freeze([1, 2, 4, 6, 10]),
  brightness: Object.freeze(['dark', 'warm', 'normal', 'bright']),
  source: Object.freeze(['auto', 'pluck', 'midi']),
  whammy: Object.freeze(['bend', 'volume', 'vibrato', 'off']),
  tilt: Object.freeze(['bend', 'volume', 'vibrato', 'off']),
  bendRange: Object.freeze([-12, -7, -5, -2, -1, 1, 2, 5, 7, 12]),
  // Design 4.2 asks for a number field (0-1000, step 10); number fields are not
  // implemented yet, so this is a choice list like fadeMs for now.
  tiltSmoothing: Object.freeze([0, 20, 40, 80, 150, 300, 600, 1000]),
});

/** Brightness names -> 0..1 for the plucked string. */
export const BRIGHTNESS_VALUES = Object.freeze({ dark: 0.15, warm: 0.35, normal: 0.55, bright: 0.85 });

/** Validators for settings that are neither enumerations nor plain values. */
const VALIDATORS = {
  program: (v) => Number.isInteger(v) && v >= -1 && v <= 127,
  // Experiment E: +-3 octaves of a 12-note scale is the most any scale allows.
  rangeOffset: (v) => Number.isInteger(v) && Math.abs(v) <= 36,
  tiltGlide: (v) => typeof v === 'boolean',
  drumMap: (v) =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v).every((n) => Number.isInteger(n) && (n === 0 || (n >= 35 && n <= 81))),
};

function isValid(key, value, defaultValue) {
  if (VALIDATORS[key]) return VALIDATORS[key](value);
  if (CHOICES[key]) return CHOICES[key].includes(value);
  return typeof value === typeof defaultValue;
}

/** Copies only known, valid keys from `stored` over `defaults`. */
function mergeWithDefaults(defaults, stored) {
  const result = { ...defaults };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(defaults)) {
      if (key in stored && isValid(key, stored[key], defaults[key])) {
        result[key] = stored[key];
      }
    }
  }
  return result;
}

function readJson(key) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn(`Settings: could not read "${key}" from localStorage`, err);
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Settings: could not save "${key}" to localStorage`, err);
  }
}

const listeners = new Set();

/**
 * Registers a callback called as fn({ scope: 'global'|'device', id, key, value })
 * after every change. Returns a function that removes the listener.
 */
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(change) {
  for (const fn of listeners) fn(change);
}

/** Returns all global settings, merged with defaults. */
export function getGlobalSettings() {
  return mergeWithDefaults(DEFAULTS.global, readJson(GLOBAL_KEY));
}

export function setGlobalSetting(key, value) {
  if (!(key in DEFAULTS.global)) throw new Error(`Unknown global setting: ${key}`);
  if (!isValid(key, value, DEFAULTS.global[key])) throw new Error(`Invalid value for ${key}: ${value}`);
  const stored = readJson(GLOBAL_KEY) || {};
  stored[key] = value;
  writeJson(GLOBAL_KEY, stored);
  notify({ scope: 'global', key, value });
}

/** Returns the settings of one device (keyed by gamepad.id), merged with defaults. */
export function getDeviceSettings(gamepadId) {
  const all = readJson(DEVICES_KEY) || {};
  return mergeWithDefaults(DEFAULTS.device, all[gamepadId]);
}

/** Removes all stored settings of one device, so it is back to the defaults. */
export function resetDeviceSettings(gamepadId) {
  const all = readJson(DEVICES_KEY) || {};
  delete all[gamepadId];
  writeJson(DEVICES_KEY, all);
  notify({ scope: 'device', id: gamepadId, key: null, value: null });
}

export function setDeviceSetting(gamepadId, key, value) {
  if (!(key in DEFAULTS.device)) throw new Error(`Unknown device setting: ${key}`);
  if (!isValid(key, value, DEFAULTS.device[key])) throw new Error(`Invalid value for ${key}: ${value}`);
  const all = readJson(DEVICES_KEY) || {};
  const entry = all[gamepadId] && typeof all[gamepadId] === 'object' ? all[gamepadId] : {};
  entry[key] = value;
  all[gamepadId] = entry;
  writeJson(DEVICES_KEY, all);
  notify({ scope: 'device', id: gamepadId, key, value });
}
