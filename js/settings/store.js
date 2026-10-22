// Settings store (design section 8, R2.7).
//
// Defaults live in one object. User changes are saved in localStorage:
// global settings under one key, per-device settings in one object keyed by
// gamepad.id. Unknown or invalid stored values fall back to the defaults, so
// adding new settings never breaks old saved data.

const GLOBAL_KEY = 'musicSandbox.global';
const DEVICES_KEY = 'musicSandbox.devices';

/** Default values. Every setting must have one. */
export const DEFAULTS = Object.freeze({
  global: Object.freeze({
    // 'auto' = use navigator.language, otherwise a language code ('en', 'sv').
    language: 'auto',
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
  }),
});

/** Allowed values for settings that are enumerations. */
export const CHOICES = Object.freeze({
  instrument: Object.freeze(['auto', 'guitar', 'drums', 'bass']),
  root: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  scale: Object.freeze(['minorPentatonic', 'majorPentatonic', 'blues', 'major', 'minor']),
  fadeMs: Object.freeze([20, 40, 80, 150, 300, 600]),
  decay: Object.freeze([1, 2, 4, 6, 10]),
  brightness: Object.freeze(['dark', 'warm', 'normal', 'bright']),
});

/** Brightness names -> 0..1 for the plucked string. */
export const BRIGHTNESS_VALUES = Object.freeze({ dark: 0.15, warm: 0.35, normal: 0.55, bright: 0.85 });

/** Validators for settings that are neither enumerations nor plain values. */
const VALIDATORS = {};

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
