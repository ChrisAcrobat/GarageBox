// Settings store (design section 8, R2.7).
//
// Defaults live in one object. User changes are saved in localStorage:
// global settings under one key, per-device settings in one object keyed by
// the device's settings id (deviceSettingsId(): detected type + slot, R2.7).
// Unknown or invalid stored values fall back to the defaults, so adding new
// settings never breaks old saved data (e.g. an old `tilt` assignment is
// simply ignored).

const GLOBAL_KEY = 'musicSandbox.global';
const DEVICES_KEY = 'musicSandbox.devices';

/**
 * The key a controller's settings are saved under (R2.7): its detected type
 * and its slot, e.g. deviceSettingsId('guitar', 0) = 'device:guitar:1'. Two
 * controllers of the same model in different slots keep their own settings.
 */
export function deviceSettingsId(type, index) {
  return `device:${type}:${index + 1}`;
}

/** Default values. Every setting must have one. */
export const DEFAULTS = Object.freeze({
  global: Object.freeze({
    // 'auto' = use navigator.language, otherwise a language code ('en', 'sv').
    language: 'auto',
    // The computer keyboard as an extra instrument is hidden by default (R4c.2).
    keyboard: false,
    // Visual style of all lanes (R5.2): 'highway' or 'simple'.
    view: 'highway',
    // Note names (R6.3): 'international' (C D E F G A B) or 'language' (the
    // language's own names, e.g. H for B in Swedish).
    noteNames: 'international',
  }),
  device: Object.freeze({
    // 'auto' = use the instrument implied by controller type detection (R2.2, R2.3).
    // Any other value is a manual choice and always wins (R2.6, R2.7).
    instrument: 'auto',
    // Key (root pitch class, 0 = C ... 4 = E ... 11 = B) and scale (R4.9).
    root: 4,
    scale: 'minorPentatonic',
    // Octave of the fret range (R4.13): -1, 0 or +1 octave.
    octave: 0,
    // Mute fade-out in milliseconds (R4.3.1, number field R2.9.1).
    fadeMs: 1000,
    // Plucked string: seconds until a note has died away (R4.7), and tone color.
    decay: 4,
    brightness: 'normal',
    // Sound source: 'auto' = the instrument's default (R3.5), or 'pluck' / 'bass' / 'midi'.
    source: 'auto',
    // General MIDI program 0-127 for the MIDI source, -1 = the instrument's default.
    program: -1,
    // Effect (R3.6): 'clean' | 'crunch' | 'epic'.
    effect: 'clean',
    // Whammy assignment (R4.5): 'bend' | 'volume' | 'off'. The tilt has no
    // assignment: it shifts the fret range (R4.5.2), toggled with Back.
    whammy: 'bend',
    // Pitch bend at full whammy, in semitones (negative = down, R4.5.7).
    bendRange: -2,
    // Tilt smoothing time constant in ms, 0 = off (R4.5.1, design 4.2).
    tiltSmoothing: 80,
    // The guitar's locked fret-range offset in scale steps (the base that
    // Back or the D-pad locks, R4.5.6). Saved per device, so it survives a
    // reload; reset to 0 with the other settings. Tilt on/off is not saved
    // (always off after a reload).
    rangeOffset: 0,
    // While tilt is on, the pitch glides continuously between scale steps
    // (the same fractional offset as the note strip, R4.14).
    tiltGlide: false,
    // What D-pad left/right do while playing (R4.15).
    dpadAction: 'octave',
    // Star power on lanes that can trigger it (R5.5).
    starPower: true,
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
  noteNames: Object.freeze(['international', 'language']),
  octave: Object.freeze([-1, 0, 1]),
  brightness: Object.freeze(['dark', 'warm', 'normal', 'bright']),
  source: Object.freeze(['auto', 'pluck', 'bass', 'midi']),
  effect: Object.freeze(['clean', 'crunch', 'epic']),
  whammy: Object.freeze(['bend', 'volume', 'off']),
  dpadAction: Object.freeze(['octave', 'effect', 'key', 'sound', 'off']),
});

/**
 * Settings edited in number fields (R2.9.1): { min, max, step }. A stored
 * value must be a finite number in the range, else the default is used; the
 * panel clamps what is typed to the range.
 */
export const NUMBER_FIELDS = Object.freeze({
  fadeMs: Object.freeze({ min: 10, max: 10000, step: 50 }),
  decay: Object.freeze({ min: 0.5, max: 30, step: 0.5 }),
  tiltSmoothing: Object.freeze({ min: 0, max: 1000, step: 10 }),
  bendRange: Object.freeze({ min: -24, max: 24, step: 1 }),
});

/** Clamps `value` to the range of number setting `key`. */
export function clampNumber(key, value) {
  const { min, max } = NUMBER_FIELDS[key];
  return Math.max(min, Math.min(max, value));
}

/** Brightness names -> 0..1 for the plucked string. */
export const BRIGHTNESS_VALUES = Object.freeze({ dark: 0.15, warm: 0.35, normal: 0.55, bright: 0.85 });

/** Validators for settings that are neither enumerations nor plain values. */
const VALIDATORS = {
  program: (v) => Number.isInteger(v) && v >= -1 && v <= 127,
  // +-3 octaves of a 12-note scale is the most any scale allows.
  rangeOffset: (v) => Number.isInteger(v) && Math.abs(v) <= 36,
  drumMap: (v) =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v).every((n) => Number.isInteger(n) && (n === 0 || (n >= 35 && n <= 81))),
};

function isValid(key, value, defaultValue) {
  if (VALIDATORS[key]) return VALIDATORS[key](value);
  if (CHOICES[key]) return CHOICES[key].includes(value);
  if (NUMBER_FIELDS[key]) {
    const { min, max } = NUMBER_FIELDS[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }
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

/** Returns the settings of one device (keyed by its settings id), merged with defaults. */
export function getDeviceSettings(id) {
  const all = readJson(DEVICES_KEY) || {};
  return mergeWithDefaults(DEFAULTS.device, all[id]);
}

/**
 * Resets the stored settings of one device to the defaults. With
 * `keepInstrument` (Back held 5 s, the panel's reset button, R4.11.2) a
 * manually chosen instrument is kept; without it (Back held 10 s, R4.11.3)
 * everything is removed, so the instrument follows detection again.
 */
export function resetDeviceSettings(id, { keepInstrument = false } = {}) {
  const all = readJson(DEVICES_KEY) || {};
  const instrument = all[id]?.instrument;
  if (keepInstrument && instrument !== undefined && isValid('instrument', instrument)) all[id] = { instrument };
  else delete all[id];
  writeJson(DEVICES_KEY, all);
  notify({ scope: 'device', id, key: null, value: null });
}

export function setDeviceSetting(id, key, value) {
  if (!(key in DEFAULTS.device)) throw new Error(`Unknown device setting: ${key}`);
  if (!isValid(key, value, DEFAULTS.device[key])) throw new Error(`Invalid value for ${key}: ${value}`);
  const all = readJson(DEVICES_KEY) || {};
  const entry = all[id] && typeof all[id] === 'object' ? all[id] : {};
  entry[key] = value;
  all[id] = entry;
  writeJson(DEVICES_KEY, all);
  notify({ scope: 'device', id, key, value });
}
