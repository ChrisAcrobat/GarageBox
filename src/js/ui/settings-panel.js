// Per-device settings panel (design 7.2, R2.9). An HTML overlay inside the
// lane, opened from the lane's settings button or with Start on the guitar
// (R4.10). Every field writes straight to the settings store; every setting
// has a default, so the panel is never needed to start playing.
//
// Opened with Start on the controller, the panel is a *gamepad menu* (design
// 7.4): main.js passes the controller's menu intents to navigate() and the
// panel shows the gamepad cursor. Opened with the mouse it is a plain panel
// (no cursor; the controller keeps playing).

import { t } from '../i18n/i18n.js';
import { CHOICES, NUMBER_FIELDS, clampNumber, getDeviceSettings, setDeviceSetting, resetDeviceSettings } from '../settings/store.js';
import { defaultInstrumentFor } from '../input/detect.js';
import { activeNoteNames } from '../audio/theory.js';
import { DEFAULT_PROGRAMS, DEFAULT_SOURCES, SOURCES_FOR, resolveSource, canStarPower } from '../instruments/setup.js';
import { DEFAULT_DRUM_MAP, DRUM_NOTES } from '../instruments/drums.js';
import { MenuNavigator } from './menu-nav.js';

/** The settings id of a device (type + slot, R2.7); fake devices without one use their id. */
export function settingsIdOf(device) {
  return device.settingsId ?? device.id;
}

/**
 * Field definitions. `when(c)` decides whether a field applies, from the
 * context c = { kind, instrument, source, device, settings }, where kind is
 * 'guitar' (guitar and bass), 'drums' or 'keys'. A field is a select
 * (`options`), a number field (`number: true`, range from NUMBER_FIELDS,
 * R2.9.1) or a checkbox (`checkbox: true`).
 */
function fieldDefinitions(device) {
  const auto = defaultInstrumentFor(device.detection);
  const has = (name) => name in device.mapping.controls;
  const guitarPart = (c) => c.kind === 'guitar' || c.kind === 'keys';
  const guitarLane = (c) => c.kind === 'guitar' && !device.isKeyboard;
  // Ring time and tone apply to the generated sources (pluck, bass); the
  // keyboard always has them for its plucked guitar emulation.
  const plucked = (c) => (c.kind === 'guitar' && (c.source === 'pluck' || c.source === 'bass')) || c.kind === 'keys';
  const fields = [];
  if (!device.isKeyboard) {
    fields.push({
      key: 'instrument',
      label: 'settings.instrument',
      options: CHOICES.instrument.map((value) => ({
        value,
        text: value === 'auto' ? t('instrument.autoWith', { instrument: t(`instrument.${auto}`) }) : t(`instrument.${value}`),
      })),
    });
  }
  fields.push(
    {
      key: 'source',
      label: 'settings.source',
      when: (c) => (SOURCES_FOR[c.instrument] || []).length > 1,
      options: (c) => [
        { value: 'auto', text: t('source.autoWith', { source: t(`source.${DEFAULT_SOURCES[c.instrument]}`) }) },
        ...SOURCES_FOR[c.instrument].map((value) => ({ value, text: t(`source.${value}`) })),
      ],
    },
    {
      key: 'program',
      label: 'settings.program',
      when: (c) => c.source === 'midi' && c.kind !== 'drums',
      options: (c) => [
        { value: -1, text: t('program.autoWith', { program: t(`gm.${DEFAULT_PROGRAMS[c.instrument] ?? 0}`) }) },
        ...Array.from({ length: 128 }, (_, i) => ({ value: i, text: `${i + 1}. ${t(`gm.${i}`)}` })),
      ],
    },
    {
      key: 'effect',
      label: 'settings.effect',
      when: (c) => c.kind !== 'drums',
      options: CHOICES.effect.map((value) => ({ value, text: t(`effect.${value}`) })),
    },
    {
      key: 'dpadAction',
      label: 'settings.dpadAction',
      when: guitarLane,
      hint: () => 'settings.dpadActionHint',
      options: CHOICES.dpadAction.map((value) => ({ value, text: t(`dpadAction.${value}`) })),
    },
    {
      key: 'root',
      label: 'settings.root',
      when: guitarPart,
      hint: (c) => (c.kind === 'keys' ? 'settings.keysGuitarHint' : null),
      options: () => CHOICES.root.map((value) => ({ value, text: activeNoteNames()[value] })),
    },
    {
      key: 'scale',
      label: 'settings.scale',
      when: guitarPart,
      options: CHOICES.scale.map((value) => ({ value, text: t(`scale.${value}`) })),
    },
    {
      key: 'octave',
      label: 'settings.octave',
      when: (c) => c.kind === 'guitar',
      options: CHOICES.octave.map((value) => ({ value, text: t(`octave.${value}`) })),
    },
    {
      key: 'whammy',
      label: 'settings.whammy',
      when: (c) => c.kind === 'guitar' && has('whammy'),
      hint: (c) => (c.settings.whammy === 'off' ? null : `settings.whammyHint.${c.settings.whammy}`),
      options: CHOICES.whammy.map((value) => ({ value, text: t(`expression.${value}`) })),
    },
    {
      key: 'bendRange',
      label: 'settings.bendRange',
      unit: 'unit.semitonesName',
      when: (c) => c.kind === 'guitar' && has('whammy') && c.settings.whammy === 'bend',
      hint: () => 'settings.bendRangeHint',
      number: true,
    },
    {
      key: 'tiltSmoothing',
      label: 'settings.tiltSmoothing',
      unit: 'unit.msName',
      when: (c) => c.kind === 'guitar' && has('tilt'),
      hint: () => 'settings.tiltSmoothingHint',
      number: true,
    },
    {
      key: 'starPower',
      label: 'settings.starPower',
      when: (c) => guitarLane(c) && canStarPower(device),
      checkbox: true,
    },
    {
      key: 'fadeMs',
      label: 'settings.fade',
      unit: 'unit.msName',
      when: guitarPart,
      number: true,
    },
    {
      key: 'decay',
      label: 'settings.decay',
      unit: 'unit.secondsName',
      when: plucked,
      number: true,
    },
    {
      key: 'brightness',
      label: 'settings.brightness',
      when: plucked,
      options: CHOICES.brightness.map((value) => ({ value, text: t(`brightness.${value}`) })),
    },
  );
  // Drums: one sound per control (R4b.2).
  for (const control of Object.keys(device.mapping.controls)) {
    if (!(control in DEFAULT_DRUM_MAP)) continue;
    fields.push({
      key: `drum:${control}`,
      label: `control.${control}`,
      when: (c) => c.kind === 'drums',
      get: (settings) => ({ ...DEFAULT_DRUM_MAP, ...settings.drumMap })[control],
      set: (settings, value) => ['drumMap', { ...settings.drumMap, [control]: value }],
      options: DRUM_NOTES.map((value) => ({ value, text: t(`drum.${value}`) })),
    });
  }
  return fields;
}

/**
 * Boolean device settings shown as checkboxes below the panel buttons. Tilt
 * glide (R4.14) only where tilt exists: guitar/bass lanes of a device with a
 * tilt control (not drums, not the keyboard's guitar keys, not a gamepad in
 * guitar mode, which has no tilt). It is the panel's last control.
 */
export function checkboxDefinitions(device) {
  const hasTilt = 'tilt' in device.mapping.controls;
  return [{ key: 'tiltGlide', label: 'settings.tiltGlide', when: (c) => c.kind === 'guitar' && hasTilt && !device.isKeyboard }];
}

export class SettingsPanel {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container lane overlay element
   * @param {import('../input/gamepad-manager.js').Device} options.device
   * @param {() => {kind: string, instrument: string}} options.getInstrument the lane's current instrument
   * @param {() => void} options.onOpenDebug
   * @param {() => void} options.onClose
   * @param {boolean} [options.focus] move the browser focus to the first field (default true; false when opened with the gamepad)
   * @param {boolean} [options.gamepadMenu] opened with the controller: gamepad cursor and navigate() are active
   */
  constructor({ container, device, getInstrument, onOpenDebug, onClose, focus = true, gamepadMenu = false }) {
    this.device = device;
    this.getInstrument = getInstrument;
    this.el = document.createElement('section');
    this.el.className = 'panel settings-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = `
      <header class="panel-header">
        <h2 class="panel-title"></h2>
        <button type="button" class="icon-button close-button">×</button>
      </header>
      <p class="detected-line"></p>
      <div class="fields"></div>
      <div class="panel-actions">
        <button type="button" class="button debug-button"></button>
        <button type="button" class="button reset-button"></button>
      </div>
      <div class="panel-options"></div>
      <p class="gamepad-hint"></p>`;
    this.titleEl = this.el.querySelector('.panel-title');
    this.closeButton = this.el.querySelector('.close-button');
    this.detectedEl = this.el.querySelector('.detected-line');
    this.fieldsEl = this.el.querySelector('.fields');
    this.debugButton = this.el.querySelector('.debug-button');
    this.resetButton = this.el.querySelector('.reset-button');
    this.hintEl = this.el.querySelector('.gamepad-hint');
    this.optionsEl = this.el.querySelector('.panel-options');
    this.onClose = onClose;
    this.gamepadMenu = !!gamepadMenu && !device.isKeyboard;

    this.closeButton.addEventListener('click', onClose);
    this.debugButton.addEventListener('click', onOpenDebug);
    // Reset to defaults keeps the chosen instrument, like Back held 5 s (R4.11.2).
    this.resetButton.addEventListener('click', () => resetDeviceSettings(settingsIdOf(device), { keepInstrument: true }));
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });

    this.nav = null;
    this.refresh();
    container.appendChild(this.el);
    // Gamepad cursor only in a gamepad menu (design 7.4).
    if (this.gamepadMenu) this.nav = new MenuNavigator(this.el, { initial: '.fields select' });
    if (focus) this.fieldsEl.querySelector('select, input')?.focus({ preventScroll: true });
  }

  /**
   * Handles one menu intent of this lane's controller (R2.12): up/down move
   * the gamepad cursor, left/right change the value, Start toggles a
   * checkbox or presses a button (it never closes the panel), Back closes it.
   * Rotation for guitars is applied by main.js before this.
   */
  navigate(intent) {
    if (!this.gamepadMenu) return;
    if (intent === 'back') {
      this.onClose();
      return;
    }
    this.nav?.navigate(intent);
  }

  /** Re-renders all texts and current values (after a language or setting change). */
  refresh() {
    const { device } = this;
    const number = device.index + 1;
    this.titleEl.textContent = t('settings.title', { number });
    this.closeButton.title = t('common.close');
    this.closeButton.setAttribute('aria-label', t('common.close'));
    this.detectedEl.textContent = t('settings.detected', { type: t(`type.${device.detection.type}`) });
    this.debugButton.textContent = t('settings.openDebug');
    this.debugButton.hidden = !!device.isKeyboard;
    this.resetButton.textContent = t('settings.reset');

    const settings = getDeviceSettings(settingsIdOf(device));
    const { kind, instrument } = this.getInstrument();
    const c = { kind, instrument, source: resolveSource(settings, instrument), device, settings };
    const focusedKey = this.el.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const fields = fieldDefinitions(device).filter((f) => !f.when || f.when(c));
    const drumFields = fields.filter((f) => f.key.startsWith('drum:'));
    const children = fields.filter((f) => !drumFields.includes(f)).map((f) => this._field(f, settings, c));
    if (drumFields.length) {
      const heading = document.createElement('h3');
      heading.className = 'fields-heading';
      heading.textContent = t('settings.drumSounds');
      children.push(heading, ...drumFields.map((f) => this._field(f, settings, c)));
    }
    this.fieldsEl.replaceChildren(...children);
    // Per-device checkboxes at the very bottom of the panel.
    this.optionsEl.replaceChildren(...checkboxDefinitions(device).filter((f) => f.when(c)).map((f) => this._checkbox(f, settings)));
    this.optionsEl.hidden = !this.optionsEl.childElementCount;
    if (focusedKey) this.el.querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
    // Gamepad menu: how to use it. Mouse-opened gamepad panel: how to get one.
    let hintKey = null;
    // A guitar controller has rotated directions (R2.12); guitar/bass lanes play frets in the menu (R2.13).
    if (this.gamepadMenu) hintKey = device.detection?.type === 'guitar' ? 'settings.gamepadHintGuitar' : kind === 'guitar' ? 'settings.gamepadHintFrets' : 'settings.gamepadHint';
    else if (!device.isKeyboard) hintKey = 'settings.gamepadHintMouse';
    this.hintEl.hidden = !hintKey;
    this.hintEl.textContent = hintKey ? t(hintKey) : '';
    this.nav?.sync();
  }

  _field(def, settings, c) {
    if (def.checkbox) return this._checkbox(def, settings);
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.className = 'field-label';
    span.textContent = def.unit ? `${t(def.label)} (${t(def.unit)})` : t(def.label);
    const control = def.number ? this._numberInput(def, settings) : this._select(def, settings, c);
    label.append(span, control);
    const hintKey = def.hint?.(c);
    if (hintKey) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = t(hintKey);
      label.append(hint);
    }
    return label;
  }

  _select(def, settings, c) {
    const select = document.createElement('select');
    select.dataset.key = def.key;
    const options = typeof def.options === 'function' ? def.options(c) : def.options;
    const current = def.get ? def.get(settings) : settings[def.key];
    options.forEach((o, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = o.text;
      option.selected = o.value === current;
      select.append(option);
    });
    select.addEventListener('change', () => {
      const id = settingsIdOf(this.device);
      const value = options[Number(select.value)].value;
      const [key, stored] = def.set ? def.set(getDeviceSettings(id), value) : [def.key, value];
      setDeviceSetting(id, key, stored);
    });
    return select;
  }

  /**
   * A number field (R2.9.1): a typed value outside the range is set to the
   * nearest allowed value; an empty or invalid entry restores the stored value.
   */
  _numberInput(def, settings) {
    const { min, max, step } = NUMBER_FIELDS[def.key];
    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.key = def.key;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[def.key]);
    input.addEventListener('change', () => {
      const id = settingsIdOf(this.device);
      const typed = input.value.trim() === '' ? NaN : Number(input.value);
      if (!Number.isFinite(typed)) {
        input.value = String(getDeviceSettings(id)[def.key]);
        return;
      }
      const value = clampNumber(def.key, typed);
      input.value = String(value);
      setDeviceSetting(id, def.key, value);
    });
    return input;
  }

  /** A checkbox row for a boolean device setting (the gamepad menu toggles it with Start). */
  _checkbox(def, settings) {
    const label = document.createElement('label');
    label.className = 'field field-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.key = def.key;
    input.checked = settings[def.key] === true;
    input.addEventListener('change', () => setDeviceSetting(settingsIdOf(this.device), def.key, input.checked));
    const span = document.createElement('span');
    span.className = 'field-checkbox-label';
    span.textContent = t(def.label);
    label.append(input, span);
    return label;
  }

  destroy() {
    this.el.remove();
  }
}
