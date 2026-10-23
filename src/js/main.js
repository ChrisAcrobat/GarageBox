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
import { HighwayState, drawHighway, placeNote } from './visual/highway-view.js';
import { StartScreen } from './ui/start-screen.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { DebugView } from './ui/debug-view.js';
import { MenuInput, MENU_CONTROLS } from './ui/menu-nav.js';
import { CHOICES, getGlobalSettings, setGlobalSetting, getDeviceSettings, setDeviceSetting, resetDeviceSettings, onSettingsChange } from './settings/store.js';
import { BackHold } from './input/back-hold.js';
import { SUPPORTED_LANGUAGES, applyTranslations, onLanguageChange, setLanguage, t } from './i18n/i18n.js';
import { getAudioContext, getEngine, keepAudioAlive, unlockAudio } from './audio/audio-engine.js';
import { createInstrument, instrumentKind } from './instruments/setup.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('lanes');
const ctx = canvas.getContext('2d');
const overlayLayer = document.getElementById('lane-overlays');
const languageSelect = document.getElementById('language-select');
const keyboardToggle = document.getElementById('keyboard-toggle');
const viewSelect = document.getElementById('view-select');
const startKeyboardButton = document.getElementById('start-keyboard');

/**
 * Per-device state, keyed by device index (gamepad.index, or KEYBOARD_INDEX):
 * { device, el, gear, instrument (name), kind, logic (Instrument|null),
 *   channels: { main: Channel, guitar?: Channel }, highway: HighwayState,
 *   panel: SettingsPanel|null, debug: DebugView|null, menuInput: MenuInput }
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
  const ui = {
    device,
    el,
    gear,
    instrument: null,
    kind: null,
    logic: null,
    channels: {},
    highway: new HighwayState(),
    panel: null,
    debug: null,
    menuInput: new MenuInput(),
    // Experiment E: Back hold (5 s = reset settings) for instruments that do
    // not handle Back themselves (the guitar does, see guitar.js).
    backHold: new BackHold(),
  };
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
  clearTimeout(ui.toastTimer);
  releaseInstrument(ui);
  ui.el.remove();
  laneUis.delete(index);
}

/**
 * Opens or closes the settings panel. Opened with Start on the controller
 * (`byGamepad`) it is a *gamepad menu*: the controller navigates it, frets
 * tap-to-play, and the browser focus is left alone, so no second focus ring
 * appears next to the gamepad cursor and the computer keyboard keeps playing.
 * Opened with the mouse (or keyboard) it is a plain panel and the instrument
 * plays exactly as without a panel (design 7.4).
 */
function toggleSettings(index, { byGamepad = false } = {}) {
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
    getInstrument: () => ({ kind: ui.kind, instrument: ui.instrument }),
    onClose: () => closeSettings(index),
    onOpenDebug: () => openDebug(index),
    focus: !byGamepad,
    gamepadMenu: byGamepad && !ui.device.isKeyboard,
  });
}

function closeSettings(index) {
  const ui = laneUis.get(index);
  if (!ui?.panel) return;
  // Give the focus back to the lane's button only if it was in the panel
  // (mouse or keyboard use); a gamepad close does not move the focus.
  const hadFocus = ui.panel.el.contains(document.activeElement);
  ui.panel.destroy();
  ui.panel = null;
  if (hadFocus) ui.gear.focus({ preventScroll: true });
}

function openDebug(index) {
  const ui = laneUis.get(index);
  if (!ui || ui.device.isKeyboard) return;
  // Opened with the mouse or keyboard the focus is in the panel; with the
  // gamepad (D-pad right on the button) it is not, and stays where it is.
  const focus = !!ui.panel?.el.contains(document.activeElement);
  // The view is a gamepad menu only if the panel it was opened from was one.
  const gamepadMenu = !!ui.panel?.gamepadMenu;
  closeSettings(index);
  if (ui.debug) return;
  ui.debug = new DebugView({ container: ui.el, device: ui.device, onClose: () => closeDebug(index), focus, gamepadMenu });
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
  ui.highway.clear();
  ui.instrument = name;
  ui.kind = instrumentKind(name);
  if (!created) return;
  ui.logic = created.instrument;
  ui.channels = {};
  for (const [part, sound] of Object.entries(created.sounds)) ui.channels[part] = getEngine().createChannel(sound);
}

/**
 * Gamepad menu navigation (design 7.4). Only while a menu is open: the start
 * screen (any controller), or this lane's settings panel or device
 * information view (only this lane's controller) when it was opened with the
 * controller (a gamepad menu; a panel opened with the mouse leaves the
 * controller playing as usual). Returns the control edges
 * that are left for the instrument: while a menu is open the D-pad (and on a
 * guitar the strum bar, which is the same raw buttons) and Back only
 * navigate. Start is left to the instrument, which toggles the panel as
 * before (R4.10).
 */
function menuInput(ui, nowMs) {
  const edges = ui.device.controlEdges;
  if (ui.device.isKeyboard) return edges;
  const startActive = !!startScreen?.active;
  const menu = [ui.panel, ui.debug].find((m) => m?.gamepadMenu);
  if (!startActive && !menu) {
    ui.menuInput.reset();
    return edges;
  }
  // Experiment E: while a menu owns Back, no Back hold or tilt toggle may be
  // pending; the release of a Back press that closed a menu then does nothing.
  ui.logic?.cancelBackHold?.();
  ui.backHold.cancel();
  const intents = ui.menuInput.update(edges, ui.device.controls, nowMs);
  if (startActive) {
    for (const intent of intents) startScreen.navigate(intent);
    return edges.filter((e) => !MENU_CONTROLS.has(e.name) && e.name !== 'start');
  }
  for (const intent of intents) {
    if (intent === 'start') continue;
    // A previous intent may have closed or replaced the menu (Back, a button).
    [ui.panel, ui.debug].find((m) => m?.gamepadMenu)?.navigate(intent);
  }
  return edges.filter((e) => !MENU_CONTROLS.has(e.name));
}

/** Feeds one frame of input to every instrument and routes its events. */
function playInstruments() {
  const now = nowSeconds();
  for (const ui of laneUis.values()) {
    const edges = menuInput(ui, now * 1000);
    if (!ui.logic) continue;
    // Tap-to-play only while the settings panel is open as a gamepad menu (design 7.4).
    ui.logic.setTapToPlay?.(!!ui.panel?.gamepadMenu);
    const events = ui.logic.handle(edges, ui.device.controls, now);
    if (!ui.logic.handlesBackHold) events.push(...genericBackHold(ui, edges, now));
    for (const event of events) {
      if (event.type === 'action') {
        if (event.action === 'openSettings') toggleSettings(ui.device.index, { byGamepad: !ui.device.isKeyboard });
        else if (event.action === 'tiltToggled') {
          // Experiment E: no toast (owner feedback); locking (tilt off) saves
          // the new base with the device settings.
          if (!event.enabled && !ui.device.isKeyboard) saveRangeOffset(ui, event.base);
        }
        else if (event.action === 'resetSettings') resetLaneSettings(ui);
        continue;
      }
      const channel = ui.channels[event.part || 'main'] || ui.channels.main;
      channel.handle(event, now);
      if (event.type === 'noteOn') {
        const columns = ui.kind === 'drums' ? ui.logic.pads.length : 5;
        ui.highway.noteOn(event, channel.tracker, placeNote(ui.kind, event, laneColorOf(ui), columns), now);
      }
    }
  }
}

/**
 * Experiment E: Back held 5 s on an instrument without its own Back handling
 * (drums, ...): the same 'resetSettings' action as the guitar emits.
 */
function genericBackHold(ui, edges, now) {
  for (const e of edges) {
    if (e.name !== 'back') continue;
    if (e.type === 'pressed') ui.backHold.press(now);
    else if (e.type === 'released' && ui.backHold.release(now) === 'hold') return [{ type: 'action', action: 'resetSettings', time: now }];
  }
  return ui.backHold.update(now) === 'hold' ? [{ type: 'action', action: 'resetSettings', time: now }] : [];
}

/** Experiment E: stores the guitar's locked range offset as a device setting (survives a reload). */
function saveRangeOffset(ui, base) {
  if (!Number.isInteger(base) || getDeviceSettings(ui.device.id).rangeOffset === base) return;
  setDeviceSetting(ui.device.id, 'rangeOffset', Math.max(-36, Math.min(36, base)));
}

/**
 * Experiment E: resets this controller's stored settings to the defaults
 * (only this device; global settings such as language and view stay). The
 * settings listener then rebuilds or reconfigures the instrument and
 * refreshes an open panel. Ringing guitar notes were already muted by the
 * guitar itself.
 */
function resetLaneSettings(ui) {
  resetDeviceSettings(ui.device.id);
  showLaneToast(ui, t('lane.settingsReset'));
}

/**
 * Experiment D/E: a short message in the lane (experiment E: only "Settings
 * reset" after a 5 s Back hold). One toast per lane; a new one replaces the old
 * one and restarts its timer. It fades out after about 1.2 s.
 */
const TOAST_MS = 1200;
function showLaneToast(ui, text) {
  if (!ui.toast) {
    ui.toast = document.createElement('div');
    ui.toast.className = 'lane-toast';
    ui.toast.setAttribute('role', 'status');
    ui.toast.setAttribute('aria-live', 'polite');
    ui.el.append(ui.toast);
  }
  ui.toast.textContent = text;
  ui.toast.classList.add('visible');
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => ui.toast?.classList.remove('visible'), TOAST_MS);
}

function laneColorOf(ui) {
  return lanes.find((lane) => lane.device === ui.device)?.color || '#ffffff';
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
    const view = {
      device: ui.device,
      color: lane.color,
      kind: ui.kind,
      instrument: ui.logic,
      channels: ui.channels,
      highway: ui.highway,
    };
    // Visual style is a global setting (R5.2, design 6).
    if (visualStyle === 'highway') drawHighway(ctx, view, area, t, now);
    else {
      ui.highway.update(now);
      drawSimpleView(ctx, view, area, t, now);
    }
  }
}

let startScreen = null;
let visualStyle = getGlobalSettings().view;

function frame() {
  manager.poll();
  keyboard.poll();
  playInstruments();
  if (layoutDirty) layout();
  draw();
  for (const ui of laneUis.values()) ui.debug?.update();
  startScreen?.update(manager.devices.size > 0 || keyboard.enabled, manager.devices.size > 0);
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

function fillViewSelect() {
  viewSelect.replaceChildren(
    ...CHOICES.view.map((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = t(`view.${value}`);
      option.selected = value === visualStyle;
      return option;
    }),
  );
}

function onLanguageChanged() {
  document.title = t('app.title');
  applyTranslations(document);
  fillLanguageSelect();
  fillViewSelect();
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
  viewSelect.addEventListener('change', () => {
    setGlobalSetting('view', viewSelect.value);
    viewSelect.blur();
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
      else if (change.key === 'view') {
        visualStyle = change.value;
        fillViewSelect();
      }
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
    // A gamepad button is no user gesture, so sound may stay blocked (7.1, 7.4).
    onGamepadStart: async () => {
      const ctx = await Promise.race([unlockAudio(), new Promise((resolve) => setTimeout(resolve, 500))]);
      const context = ctx || getAudioContext();
      return !context || context.state === 'running';
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

main().catch((err) => console.error('GarageBox - Music Sandbox failed to start', err));
