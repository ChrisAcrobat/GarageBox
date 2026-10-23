// Internationalization (design section 8, R6.2).
//
// Loads lang/common.json (words that are the same in every language) plus
// lang/<lang>.json. English is always loaded as the fallback. UI code only
// uses text keys through t(); it never contains literal UI strings.

const LANG_DIR = new URL('../../lang/', import.meta.url);

/** Languages with a lang/<code>.json file. The first one is the fallback. */
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'sv']);
const FALLBACK = SUPPORTED_LANGUAGES[0];
/** Used only if common.json could not be loaded. */
const DEFAULT_NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

let common = {};
let fallback = {};
let current = {};
let currentLang = FALLBACK;
const warnedKeys = new Set();
const listeners = new Set();

async function loadJson(name) {
  const url = new URL(`${name}.json`, LANG_DIR);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

/**
 * Picks a supported language code from the setting ('auto' or a code) and the
 * browser's preferred languages, e.g. 'sv-SE' -> 'sv'. Falls back to English.
 */
export function resolveLanguage(setting, preferred = navigator.languages || [navigator.language]) {
  if (setting && setting !== 'auto' && SUPPORTED_LANGUAGES.includes(setting)) return setting;
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return FALLBACK;
}

/** Loads the language chosen from `setting` ('auto' or a code). */
export async function setLanguage(setting) {
  const lang = resolveLanguage(setting);
  try {
    if (!Object.keys(common).length) common = await loadJson('common');
  } catch (err) {
    console.warn('i18n: could not load common.json', err);
  }
  try {
    if (!Object.keys(fallback).length) fallback = await loadJson(FALLBACK);
  } catch (err) {
    console.error(`i18n: could not load ${FALLBACK}.json`, err);
  }
  if (lang === FALLBACK) {
    current = fallback;
  } else {
    try {
      current = await loadJson(lang);
    } catch (err) {
      console.warn(`i18n: could not load ${lang}.json, using ${FALLBACK}`, err);
      current = fallback;
    }
  }
  currentLang = current === fallback ? FALLBACK : lang;
  document.documentElement.lang = currentLang;
  for (const fn of listeners) fn(currentLang);
  return currentLang;
}

export function getLanguage() {
  return currentLang;
}

/**
 * Returns the text for `key`, looked up in the current language, then
 * common.json, then English. `{name}` placeholders are replaced from `params`.
 * A missing key returns the key itself (and warns once).
 */
export function t(key, params) {
  let text = current[key] ?? common[key] ?? fallback[key];
  if (text === undefined) {
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`i18n: missing text key "${key}"`);
    }
    text = key;
  }
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }
  return text;
}

/** The international note names (R6.3): the list `notes.names` in common.json. */
export function internationalNoteNames() {
  const list = common['notes.names'];
  return Array.isArray(list) && list.length === 12 ? list : DEFAULT_NOTE_NAMES;
}

/** The current language's note names, or null when it has no list of its own (R6.3). */
export function languageNoteNames() {
  const list = current['notes.names'];
  return Array.isArray(list) && list.length === 12 ? list : null;
}

/** True when the current language's note names differ from the international ones (the "Note names" select is shown). */
export function hasLanguageNoteNames() {
  const own = languageNoteNames();
  return !!own && own.some((name, i) => name !== internationalNoteNames()[i]);
}

/**
 * The active note names for the `noteNames` setting ('international' or
 * 'language'). 'language' has no effect in a language without its own list.
 */
export function noteNameList(choice) {
  return (choice === 'language' && languageNoteNames()) || internationalNoteNames();
}

/**
 * Fills elements below `root` that carry data-i18n (text content),
 * data-i18n-title (title attribute) or data-i18n-aria-label (aria-label).
 */
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  }
}

/** Registers fn(lang), called after every language change. Returns an unsubscribe function. */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
