// Per-device settings panel (design 7.2, R2.9). Milestone 1 contains the
// instrument type selector (R2.6, R2.7) and the button that opens the
// device's debug view (9.1). The panel is an HTML overlay inside the lane.

import { t } from '../i18n/i18n.js';
import { CHOICES, getDeviceSettings, setDeviceSetting } from '../settings/store.js';
import { defaultInstrumentFor } from '../input/detect.js';

export class SettingsPanel {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container lane overlay element
   * @param {import('../input/gamepad-manager.js').Device} options.device
   * @param {() => void} options.onOpenDebug
   * @param {() => void} options.onClose
   */
  constructor({ container, device, onOpenDebug, onClose }) {
    this.device = device;
    this.el = document.createElement('section');
    this.el.className = 'panel settings-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = `
      <header class="panel-header">
        <h2 class="panel-title"></h2>
        <button type="button" class="icon-button close-button">×</button>
      </header>
      <p class="detected-line"></p>
      <label class="field">
        <span class="field-label"></span>
        <select class="instrument-select"></select>
      </label>
      <div class="panel-actions">
        <button type="button" class="button debug-button"></button>
      </div>`;
    this.titleEl = this.el.querySelector('.panel-title');
    this.closeButton = this.el.querySelector('.close-button');
    this.detectedEl = this.el.querySelector('.detected-line');
    this.labelEl = this.el.querySelector('.field-label');
    this.select = this.el.querySelector('.instrument-select');
    this.debugButton = this.el.querySelector('.debug-button');

    this.closeButton.addEventListener('click', onClose);
    this.debugButton.addEventListener('click', onOpenDebug);
    this.select.addEventListener('change', () => {
      setDeviceSetting(device.id, 'instrument', this.select.value);
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });

    this.refresh();
    container.appendChild(this.el);
    this.select.focus({ preventScroll: true });
  }

  /** Re-renders all texts and the current setting (after a language or setting change). */
  refresh() {
    const { device } = this;
    const number = device.index + 1;
    const detection = device.detection;
    this.titleEl.textContent = t('settings.title', { number });
    this.closeButton.title = t('common.close');
    this.closeButton.setAttribute('aria-label', t('common.close'));
    this.detectedEl.textContent = t('settings.detected', { type: t(`type.${detection.type}`) });
    this.labelEl.textContent = t('settings.instrument');
    this.debugButton.textContent = t('settings.openDebug');

    const current = getDeviceSettings(device.id).instrument;
    const auto = defaultInstrumentFor(detection);
    this.select.replaceChildren(
      ...CHOICES.instrument.map((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent =
          value === 'auto' ? t('instrument.autoWith', { instrument: t(`instrument.${auto}`) }) : t(`instrument.${value}`);
        option.selected = value === current;
        return option;
      }),
    );
  }

  destroy() {
    this.el.remove();
  }
}
