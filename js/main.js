// App start-up, main loop and wiring (design section 1).
//
// Every frame: poll the gamepads (and the computer keyboard, when it is on),
// feed each device's logical control edges to its instrument, send the
// resulting note events to the instrument's audio channels, and draw all
// lanes (design 1).

import { GamepadManager } from './input/gamepad-manager.js';
import { defaultInstrumentFor } from './input/detect.js';
import { KeyboardDevice } from './input/keyboard-input.js';
import { computeLanes, drawLaneFrame } from './visual/lanes.js';
import { drawSimpleView } from './visual/simple-view.js';
import { StartScreen } from './ui/start-screen.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { DebugView } from './ui/debug-view.js';
import { getGlobalSettings, setGlobalSetting, getDeviceSettings, onSettingsChange } from './settings/store.js';
import { SUPPORTED_LANGUAGES, applyTranslations, onLanguageChange, setLanguage, t } from './i18n/i18n.js';
import { getEngine, keepAudioAlive, unlockAudio } from './audio/audio-engine.js';
import { createInstrument, instrumentKind } from './instruments/setup.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('lanes');
const ctx = canvas.getContext('2d');
const overlayLayer = document.getElementById('lane-overlays');
const languageSelect = document.getElementById('language-select');
const keyboardToggle = document.getElementById('keyboard-toggle');
const startKeyboardButton = document.getElementById('start-keyboard');

/**
 * Per-device state, keyed by device index (gamepad.index, or KEYBOARD_INDEX):
 * { device, el, gear, instrument (name), kind, logic (Instrument|null),
 *   channels: { main: Channel, guitar?: Channel }, panel: SettingsPanel|null,
 *   debug: DebugView|null }
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

const keyboard = new KeyboardDevice();

/** All devices in lane order: gamepads by index, then the keyboard (design 3.2). */
function allDevices() {
  const list = manager.list();
  if (keyboard.enabled) list.push(keyboard);
  return list;
}

/** Instrument used by a device: the stored manual choice, else the detected default (R2.6, R2.7). */
function effectiveInstrument(device) {
  if (device.isKeyboard) return 'keys';
  const stored = getDeviceSettings(device.id).instrument;
  return stored === 'auto' ? defaultInstrumentFor(device.detection) : stored;
}

function laneNumber(device) {
  return device.isKeyboard ? t('lane.keyboard') : String(device.index + 1);
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
  const ui = { device, el, gear, instrument: null, kind: null, logic: null, channels: {}, panel: null, debug: null };
  laneUis.set(device.index, ui);
  translateLaneUi(ui);
  setupInstrument(ui);
}

function translateLaneUi(ui) {
  const label = ui.device.isKeyboard ? t('lane.keyboardSettings') : t('lane.settingsButton', { number: ui.device.index + 1 });
  ui.gear.title = label;
  ui.gear.setAttribute('aria-label', label);
}

function destroyLaneUi(index) {
  const ui = laneUis.get(index);
  if (!ui) return;
  ui.panel?.destroy();
  ui.debug?.destroy();
  releaseInstrument(ui);
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
    getKind: () => ui.kind,
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
  if (!ui || ui.device.isKeyboard) return;
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
// Instruments and sound

function nowSeconds() {
  return performance.now() / 1000;
}

function releaseInstrument(ui) {
  const now = nowSeconds();
  for (const channel of Object.values(ui.channels)) {
    channel.allOff(now);
    channel.dispose();
  }
  ui.channels = {};
  ui.logic = null;
}

/**
 * Creates (or updates) the instrument of a lane from its settings. Changing
 * only musical settings keeps ringing notes; changing the instrument type
 * replaces the instrument and its sound.
 */
function setupInstrument(ui) {
  const name = effectiveInstrument(ui.device);
  const settings = getDeviceSettings(ui.device.id);
  const created = createInstrument(ui.device, name, settings);
  if (ui.logic && ui.instrument === name && created) {
    ui.logic.configure(created.instrument.options);
    for (const [part, sound] of Object.entries(created.sounds)) ui.channels[part]?.configure(sound);
    return;
  }
  releaseInstrument(ui);
  ui.instrument = name;
  ui.kind = instrumentKind(name);
  if (!created) return;
  ui.logic = created.instrument;
  ui.channels = {};
  for (const [part, sound] of Object.entries(created.sounds)) ui.channels[part] = getEngine().createChannel(sound);
}

/** Feeds one frame of input to every instrument and routes its events. */
function playInstruments() {
  const now = nowSeconds();
  for (const ui of laneUis.values()) {
    if (!ui.logic) continue;
    const events = ui.logic.handle(ui.device.controlEdges, ui.device.controls, now);
    for (const event of events) {
      if (event.type === 'action') {
        if (event.action === 'openSettings') toggleSettings(ui.device.index);
        continue;
      }
      (ui.channels[event.part || 'main'] || ui.channels.main).handle(event, now);
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard instrument (R4c)

function applyKeyboardSetting() {
  const on = getGlobalSettings().keyboard;
  keyboardToggle.checked = on;
  if (on && !keyboard.enabled) {
    keyboard.enable();
    createLaneUi(keyboard);
  } else if (!on && keyboard.enabled) {
    keyboard.disable();
    destroyLaneUi(keyboard.index);
  }
  layoutDirty = true;
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
  lanes = computeLanes(allDevices(), size.width, size.height);
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
  const now = nowSeconds();
  ctx.clearRect(0, 0, size.width, size.height);
  for (const lane of lanes) {
    const ui = laneUis.get(lane.device.index);
    if (!ui) continue;
    const area = drawLaneFrame(ctx, lane, {
      number: laneNumber(lane.device),
      title: t(`instrument.${ui.instrument}`),
    });
    // The debug view covers the whole lane; no need to draw its content.
    if (ui.debug) continue;
    const view = { device: ui.device, color: lane.color, kind: ui.kind, instrument: ui.logic, channels: ui.channels };
    drawSimpleView(ctx, view, area, t, now);
  }
}

let startScreen = null;

function frame() {
  manager.poll();
  keyboard.poll();
  playInstruments();
  if (layoutDirty) layout();
  draw();
  for (const ui of laneUis.values()) ui.debug?.update();
  startScreen?.update(manager.devices.size > 0 || keyboard.enabled);
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

  // Top bar controls give the focus back afterwards, so the computer keyboard
  // plays again right away (it ignores keys typed into form fields).
  languageSelect.addEventListener('change', () => {
    setGlobalSetting('language', languageSelect.value);
    languageSelect.blur();
  });
  keyboardToggle.addEventListener('change', () => {
    setGlobalSetting('keyboard', keyboardToggle.checked);
    keyboardToggle.blur();
  });
  startKeyboardButton.addEventListener('click', () => setGlobalSetting('keyboard', true));
  onSettingsChange((change) => {
    if (change.scope === 'global') {
      if (change.key === 'language') setLanguage(change.value);
      else if (change.key === 'keyboard') applyKeyboardSetting();
    } else if (change.scope === 'device') {
      for (const ui of laneUis.values()) {
        if (ui.device.id === change.id) {
          setupInstrument(ui);
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

  // Read-only handles for poking around in the browser console.
  window.musicSandbox = { manager, keyboard, lanes: laneUis, engine: getEngine() };

  new ResizeObserver(resize).observe(stage);
  resize();
  manager.start();
  applyKeyboardSetting();
  requestAnimationFrame(frame);
}

main().catch((err) => console.error('Music Sandbox failed to start', err));
