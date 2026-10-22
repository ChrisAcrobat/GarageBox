// Per-device settings panel (design 7.2, R2.9). An HTML overlay inside the
// lane, opened from the lane's settings button or with Start on the guitar
// (R4.10). Every field writes straight to the settings store; every setting
// has a default, so the panel is never needed to start playing.

import { t } from '../i18n/i18n.js';
import { CHOICES, getDeviceSettings, setDeviceSetting, resetDeviceSettings } from '../settings/store.js';
import { defaultInstrumentFor } from '../input/detect.js';
import { NOTE_NAMES } from '../audio/theory.js';
import { DEFAULT_PROGRAMS, DEFAULT_SOURCES, SOURCES_FOR, resolveSource } from '../instruments/setup.js';
import { DEFAULT_DRUM_MAP, DRUM_NOTES } from '../instruments/drums.js';

/**
 * Field definitions. `when(c)` decides whether a field applies, from the
 * context c = { kind, instrument, source, device, settings }, where kind is
 * 'guitar' (guitar and bass), 'drums' or 'keys'.
 */
function fieldDefinitions(device) {
  const auto = defaultInstrumentFor(device.detection);
  const has = (name) => name in device.mapping.controls;
  const guitarPart = (c) => c.kind === 'guitar' || c.kind === 'keys';
  const plucked = (c) => (c.kind === 'guitar' && c.source === 'pluck') || c.kind === 'keys';
  const expression = (c) => c.kind === 'guitar' && (has('whammy') || has('tilt'));
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
      key: 'root',
      label: 'settings.root',
      when: guitarPart,
      hint: (c) => (c.kind === 'keys' ? 'settings.keysGuitarHint' : null),
      options: CHOICES.root.map((value) => ({ value, text: NOTE_NAMES[value] })),
    },
    {
      key: 'scale',
      label: 'settings.scale',
      when: guitarPart,
      options: CHOICES.scale.map((value) => ({ value, text: t(`scale.${value}`) })),
    },
    {
      key: 'whammy',
      label: 'settings.whammy',
      when: (c) => expression(c) && has('whammy'),
      hint: (c) => (c.settings.whammy === 'off' ? null : `settings.whammyHint.${c.settings.whammy}`),
      options: CHOICES.whammy.map((value) => ({ value, text: t(`expression.${value}`) })),
    },
    {
      key: 'tilt',
      label: 'settings.tilt',
      when: (c) => expression(c) && has('tilt'),
      hint: (c) => (c.settings.tilt === 'off' ? null : `settings.tiltHint.${c.settings.tilt}`),
      options: CHOICES.tilt.map((value) => ({ value, text: t(`expression.${value}`) })),
    },
    {
      key: 'bendRange',
      label: 'settings.bendRange',
      when: (c) => expression(c) && (c.settings.whammy === 'bend' || c.settings.tilt === 'bend'),
      hint: () => 'settings.bendRangeHint',
      options: CHOICES.bendRange.map((value) => ({ value, text: t('unit.semitones', { value: value > 0 ? `+${value}` : String(value).replace('-', '−') }) })),
    },
    {
      key: 'fadeMs',
      label: 'settings.fade',
      when: guitarPart,
      options: CHOICES.fadeMs.map((value) => ({ value, text: t('unit.ms', { value }) })),
    },
    {
      key: 'decay',
      label: 'settings.decay',
      when: plucked,
      options: CHOICES.decay.map((value) => ({ value, text: t('unit.seconds', { value }) })),
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

export class SettingsPanel {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container lane overlay element
   * @param {import('../input/gamepad-manager.js').Device} options.device
   * @param {() => {kind: string, instrument: string}} options.getInstrument the lane's current instrument
   * @param {() => void} options.onOpenDebug
   * @param {() => void} options.onClose
   */
  constructor({ container, device, getInstrument, onOpenDebug, onClose }) {
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
      </div>`;
    this.titleEl = this.el.querySelector('.panel-title');
    this.closeButton = this.el.querySelector('.close-button');
    this.detectedEl = this.el.querySelector('.detected-line');
    this.fieldsEl = this.el.querySelector('.fields');
    this.debugButton = this.el.querySelector('.debug-button');
    this.resetButton = this.el.querySelector('.reset-button');

    this.closeButton.addEventListener('click', onClose);
    this.debugButton.addEventListener('click', onOpenDebug);
    this.resetButton.addEventListener('click', () => resetDeviceSettings(device.id));
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });

    this.refresh();
    container.appendChild(this.el);
    this.fieldsEl.querySelector('select')?.focus({ preventScroll: true });
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

    const settings = getDeviceSettings(device.id);
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
    if (focusedKey) this.fieldsEl.querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
  }

  _field(def, settings, c) {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.className = 'field-label';
    span.textContent = t(def.label);
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
      const value = options[Number(select.value)].value;
      const [key, stored] = def.set ? def.set(getDeviceSettings(this.device.id), value) : [def.key, value];
      setDeviceSetting(this.device.id, key, stored);
    });
    label.append(span, select);
    const hintKey = def.hint?.(c);
    if (hintKey) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = t(hintKey);
      label.append(hint);
    }
    return label;
  }

  destroy() {
    this.el.remove();
  }
}
