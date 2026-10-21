// App start-up, main loop and wiring (design section 1).
//
// Milestone 1: start screen, gamepad polling with edge detection, controller
// type detection, lanes side by side with a placeholder simple view, a
// per-device settings panel with instrument choice and debug view, settings
// store and i18n. No sound yet; the AudioContext is only created and resumed.

import { GamepadManager } from './input/gamepad-manager.js';
import { defaultInstrumentFor } from './input/detect.js';
import { computeLanes, drawLaneFrame } from './visual/lanes.js';
import { drawSimpleView } from './visual/simple-view.js';
import { StartScreen } from './ui/start-screen.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { DebugView } from './ui/debug-view.js';
import { getGlobalSettings, setGlobalSetting, getDeviceSettings, onSettingsChange } from './settings/store.js';
import { SUPPORTED_LANGUAGES, applyTranslations, onLanguageChange, setLanguage, t } from './i18n/i18n.js';
import { keepAudioAlive, unlockAudio } from './audio/audio-engine.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('lanes');
const ctx = canvas.getContext('2d');
const overlayLayer = document.getElementById('lane-overlays');
const languageSelect = document.getElementById('language-select');

/**
 * Per-device UI state, keyed by gamepad.index:
 * { device, el, gear, instrument, panel: SettingsPanel|null, debug: DebugView|null }
 */
const laneUis = new Map();
let lanes = [];
let layoutDirty = true;
const size = { width: 0, height: 0 };

const manager = new GamepadManager({
  onConnect: (device) => {
    console.info(`Controller ${device.index + 1} connected: "${device.id}" -> ${device.detection.type} (${device.detection.source}), mapping ${device.mapping.name}`);
    createLaneUi(device);
    layoutDirty = true;
  },
  onDisconnect: (device) => {
    console.info(`Controller ${device.index + 1} disconnected: "${device.id}"`);
    destroyLaneUi(device.index);
    layoutDirty = true;
  },
});

/** Instrument used by a device: the stored manual choice, else the detected default (R2.6, R2.7). */
function effectiveInstrument(device) {
  const stored = getDeviceSettings(device.id).instrument;
  return stored === 'auto' ? defaultInstrumentFor(device.detection) : stored;
}

// ---------------------------------------------------------------------------
// Lane overlays (settings button, settings panel, debug view)

function createLaneUi(device) {
  const el = document.createElement('div');
  el.className = 'lane-ui';
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'icon-button lane-settings-button';
  gear.textContent = '⚙';
  gear.addEventListener('click', () => toggleSettings(device.index));
  el.append(gear);
  overlayLayer.append(el);
  const ui = { device, el, gear, instrument: effectiveInstrument(device), panel: null, debug: null };
  laneUis.set(device.index, ui);
  translateLaneUi(ui);
}

function translateLaneUi(ui) {
  const label = t('lane.settingsButton', { number: ui.device.index + 1 });
  ui.gear.title = label;
  ui.gear.setAttribute('aria-label', label);
}

function destroyLaneUi(index) {
  const ui = laneUis.get(index);
  if (!ui) return;
  ui.panel?.destroy();
  ui.debug?.destroy();
  ui.el.remove();
  laneUis.delete(index);
}

function toggleSettings(index) {
  const ui = laneUis.get(index);
  if (!ui) return;
  if (ui.panel) {
    closeSettings(index);
    return;
  }
  closeDebug(index);
  ui.panel = new SettingsPanel({
    container: ui.el,
    device: ui.device,
    onClose: () => closeSettings(index),
    onOpenDebug: () => openDebug(index),
  });
}

function closeSettings(index) {
  const ui = laneUis.get(index);
  if (!ui?.panel) return;
  ui.panel.destroy();
  ui.panel = null;
  ui.gear.focus({ preventScroll: true });
}

function openDebug(index) {
  const ui = laneUis.get(index);
  if (!ui) return;
  closeSettings(index);
  if (ui.debug) return;
  ui.debug = new DebugView({ container: ui.el, device: ui.device, onClose: () => closeDebug(index) });
  ui.el.classList.add('debug-open');
}

function closeDebug(index) {
  const ui = laneUis.get(index);
  if (!ui?.debug) return;
  ui.debug.destroy();
  ui.debug = null;
  ui.el.classList.remove('debug-open');
}

// ---------------------------------------------------------------------------
// Layout and drawing

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  size.width = Math.max(1, Math.floor(rect.width));
  size.height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layoutDirty = true;
}

function layout() {
  lanes = computeLanes(manager.list(), size.width, size.height);
  for (const lane of lanes) {
    const ui = laneUis.get(lane.device.index);
    if (!ui) continue;
    Object.assign(ui.el.style, {
      left: `${lane.x}px`,
      top: `${lane.y}px`,
      width: `${lane.w}px`,
      height: `${lane.h}px`,
    });
    ui.el.style.setProperty('--lane-color', lane.color);
  }
  stage.classList.toggle('empty', lanes.length === 0);
  layoutDirty = false;
}

function draw() {
  ctx.clearRect(0, 0, size.width, size.height);
  for (const lane of lanes) {
    const ui = laneUis.get(lane.device.index);
    const instrument = ui ? ui.instrument : effectiveInstrument(lane.device);
    const area = drawLaneFrame(ctx, lane, {
      number: String(lane.device.index + 1),
      title: t(`instrument.${instrument}`),
    });
    // The debug view covers the whole lane; no need to draw its content.
    if (!ui?.debug) drawSimpleView(ctx, lane.device, area, lane.color, t);
  }
}

let startScreen = null;

function frame() {
  manager.poll();
  if (layoutDirty) layout();
  draw();
  for (const ui of laneUis.values()) ui.debug?.update();
  startScreen?.update(manager.devices.size > 0);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Language

function fillLanguageSelect() {
  const current = getGlobalSettings().language;
  languageSelect.replaceChildren(
    ...['auto', ...SUPPORTED_LANGUAGES].map((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = t(`lang.${code}`);
      option.selected = code === current;
      return option;
    }),
  );
}

function onLanguageChanged() {
  document.title = t('app.title');
  applyTranslations(document);
  fillLanguageSelect();
  for (const ui of laneUis.values()) {
    translateLaneUi(ui);
    ui.panel?.refresh();
    ui.debug?.refresh();
  }
}

// ---------------------------------------------------------------------------
// Start-up

async function main() {
  onLanguageChange(onLanguageChanged);
  await setLanguage(getGlobalSettings().language);

  languageSelect.addEventListener('change', () => setGlobalSetting('language', languageSelect.value));
  onSettingsChange((change) => {
    if (change.scope === 'global' && change.key === 'language') {
      setLanguage(change.value);
    } else if (change.scope === 'device') {
      for (const ui of laneUis.values()) {
        if (ui.device.id === change.id) {
          ui.instrument = effectiveInstrument(ui.device);
          ui.panel?.refresh();
        }
      }
    }
  });

  startScreen = new StartScreen(document.getElementById('start-screen'), {
    onStart: () => {
      unlockAudio();
      keepAudioAlive();
    },
  });

  new ResizeObserver(resize).observe(stage);
  resize();
  manager.start();
  requestAnimationFrame(frame);
}

main().catch((err) => console.error('Music Sandbox failed to start', err));
