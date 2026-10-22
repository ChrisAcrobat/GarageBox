// Per-device settings panel (design 7.2, R2.9). An HTML overlay inside the
// lane, opened from the lane's settings button or with Start on the guitar
// (R4.10). Every field writes straight to the settings store; every setting
// has a default, so the panel is never needed to start playing.

import { t } from '../i18n/i18n.js';
import { CHOICES, getDeviceSettings, setDeviceSetting, resetDeviceSettings } from '../settings/store.js';
import { defaultInstrumentFor } from '../input/detect.js';
import { NOTE_NAMES } from '../audio/theory.js';

/**
 * Field definitions. `when(kind)` decides whether the field applies to the
 * lane's current instrument kind ('guitar' covers guitar and bass).
 */
function fieldDefinitions(device) {
  const auto = defaultInstrumentFor(device.detection);
  const guitar = (kind) => kind === 'guitar';
  return [
    {
      key: 'instrument',
      label: 'settings.instrument',
      options: CHOICES.instrument.map((value) => ({
        value,
        text: value === 'auto' ? t('instrument.autoWith', { instrument: t(`instrument.${auto}`) }) : t(`instrument.${value}`),
      })),
    },
    {
      key: 'root',
      label: 'settings.root',
      when: guitar,
      options: CHOICES.root.map((value) => ({ value, text: NOTE_NAMES[value] })),
    },
    {
      key: 'scale',
      label: 'settings.scale',
      when: guitar,
      options: CHOICES.scale.map((value) => ({ value, text: t(`scale.${value}`) })),
    },
    {
      key: 'fadeMs',
      label: 'settings.fade',
      when: guitar,
      options: CHOICES.fadeMs.map((value) => ({ value, text: t('unit.ms', { value }) })),
    },
    {
      key: 'decay',
      label: 'settings.decay',
      when: guitar,
      options: CHOICES.decay.map((value) => ({ value, text: t('unit.seconds', { value }) })),
    },
    {
      key: 'brightness',
      label: 'settings.brightness',
      when: guitar,
      options: CHOICES.brightness.map((value) => ({ value, text: t(`brightness.${value}`) })),
    },
  ];
}

export class SettingsPanel {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container lane overlay element
   * @param {import('../input/gamepad-manager.js').Device} options.device
   * @param {() => string} options.getKind current instrument kind of the lane
   * @param {() => void} options.onOpenDebug
   * @param {() => void} options.onClose
   */
  constructor({ container, device, getKind, onOpenDebug, onClose }) {
    this.device = device;
    this.getKind = getKind || (() => 'guitar');
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
    this.resetButton.textContent = t('settings.reset');

    const settings = getDeviceSettings(device.id);
    const kind = this.getKind();
    const focusedKey = this.el.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const fields = fieldDefinitions(device).filter((f) => !f.when || f.when(kind));
    this.fieldsEl.replaceChildren(...fields.map((f) => this._field(f, settings)));
    if (focusedKey) this.fieldsEl.querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
  }

  _field(def, settings) {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.className = 'field-label';
    span.textContent = t(def.label);
    const select = document.createElement('select');
    select.dataset.key = def.key;
    def.options.forEach((o, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = o.text;
      option.selected = o.value === settings[def.key];
      select.append(option);
    });
    select.addEventListener('change', () => {
      setDeviceSetting(this.device.id, def.key, def.options[Number(select.value)].value);
    });
    label.append(span, select);
    if (def.hint) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = t(def.hint);
      label.append(hint);
    }
    return label;
  }

  destroy() {
    this.el.remove();
  }
}
