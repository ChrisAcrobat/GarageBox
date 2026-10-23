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
import { SettingsPanel, settingsIdOf } from './ui/settings-panel.js';
import { DebugView } from './ui/debug-view.js';
import { MenuInput, MENU_CONTROLS, menuRotated, rotateIntent } from './ui/menu-nav.js';
import { rangeShiftedChange, dpadChange } from './ui/lane-actions.js';
import { CHOICES, getGlobalSettings, setGlobalSetting, getDeviceSettings, setDeviceSetting, resetDeviceSettings, onSettingsChange } from './settings/store.js';
import { BackHold } from './input/back-hold.js';
import { SUPPORTED_LANGUAGES, applyTranslations, onLanguageChange, setLanguage, t, noteNameList, internationalNoteNames, languageNoteNames, hasLanguageNoteNames } from './i18n/i18n.js';
import { getAudioContext, getEngine, keepAudioAlive, unlockAudio } from './audio/audio-engine.js';
import { setNoteNames } from './audio/theory.js';
import { createInstrument, instrumentKind } from './instruments/setup.js';
import { StarPowerVisual } from './visual/star-power.js';
import { prefersReducedMotion } from './visual/simple-view.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('lanes');
const ctx = canvas.getContext('2d');
const overlayLayer = document.getElementById('lane-overlays');
const languageSelect = document.getElementById('language-select');
const keyboardToggle = document.getElementById('keyboard-toggle');
const viewSelect = document.getElementById('view-select');
const noteNamesPicker = document.getElementById('note-names-picker');
const noteNamesSelect = document.getElementById('note-names-select');
const startKeyboardButton = document.getElementById('start-keyboard');

/**
 * Per-device state, keyed by device index (gamepad.index, or KEYBOARD_INDEX):
 * { device, el, gear, instrument (name), kind, logic (Instrument|null),
 *   channels: { main: Channel, guitar?: Channel, drums?: Channel },
 *   sounds (channel config per part), highway: HighwayState,
 *   panel: SettingsPanel|null, debug: DebugView|null, menuInput: MenuInput,
 *   backHold: BackHold, starPower: StarPowerVisual }
 */
const laneUis = new Map();
let lanes = [];
let layoutDirty = true;
const size = { width: 0, height: 0 };
/** The start screen (StartScreen) while the app has one, else null. */
let startScreen = null;
/** The global visual style, 'highway' or 'simple' (R5.2). */
let visualStyle = getGlobalSettings().view;

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
  const stored = getDeviceSettings(settingsIdOf(device)).instrument;
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
    // Back holds (5 s / 10 s resets, R4.11.2, R4.11.3) for instruments that
    // do not handle Back themselves (the guitar does, see guitar.js).
    backHold: new BackHold(),
    starPower: new StarPowerVisual(prefersReducedMotion()),
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
  ui.starPower?.set(false, now);
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
  const settings = getDeviceSettings(settingsIdOf(ui.device));
  const created = createInstrument(ui.device, name, settings);
  if (ui.logic && ui.instrument === name && created) {
    ui.logic.configure(created.instrument.options);
    ui.sounds = created.sounds;
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
  ui.sounds = created.sounds;
  for (const [part, sound] of Object.entries(created.sounds)) {
    if (!sound.lazy) ui.channels[part] = getEngine().createChannel(sound);
  }
}

/** The audio channel of an event's part, created on first use for a lazy sound (design 4.4). */
function channelFor(ui, part = 'main') {
  if (!ui.channels[part] && ui.sounds?.[part]) ui.channels[part] = getEngine().createChannel(ui.sounds[part]);
  return ui.channels[part] || ui.channels.main;
}

/** Number of columns the highway uses to place a lane's notes (design 6). */
function laneColumns(ui) {
  if (ui.kind === 'drums') return ui.logic.pads.length;
  // Keyboard: drum columns in Drums mode; 0 = pitch columns plus the numpad column (R4c.15).
  if (ui.kind === 'keys') return ui.logic.drumsMode ? ui.logic.drumColumns().length : 0;
  return 5;
}

/**
 * Gamepad menu navigation (design 7.4). Only while a menu is open: the start
 * screen (any controller), or this lane's settings panel or device
 * information view (only this lane's controller) when it was opened with the
 * controller (a gamepad menu; a panel opened with the mouse leaves the
 * controller playing as usual). Returns the control edges that are left for
 * the instrument: while a menu is open the D-pad (and on a guitar the strum
 * bar, which is the same raw buttons), Back and, in a gamepad menu, Start
 * only navigate (Start activates the control under the cursor, R2.12). With
 * no gamepad menu Start reaches the instrument, which asks to open the
 * settings (R4.10). On a guitar controller the lane's menus are rotated.
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
  // While a menu owns Back, no Back hold or tilt toggle may be pending; the
  // release of a Back press that closed a menu then does nothing (R4.11.1).
  ui.logic?.cancelBackHold?.();
  ui.backHold.cancel();
  // The menu takes the strum bar, so a strum hold ends now (R4.7.2); the
  // holdEnd events are played with this frame's events.
  ui.menuEvents = ui.logic?.releaseStrumHold?.(nowMs / 1000) || [];
  const intents = ui.menuInput.update(edges, ui.device.controls, nowMs);
  if (startActive) {
    // The start screen only needs Start, so it is not rotated.
    for (const intent of intents) startScreen.navigate(intent);
    return instrumentEdges(edges);
  }
  const rotated = menuRotated(ui.device);
  for (const intent of intents) {
    // A previous intent may have closed or replaced the menu (Back, a button).
    [ui.panel, ui.debug].find((m) => m?.gamepadMenu)?.navigate(rotated ? rotateIntent(intent) : intent);
  }
  return instrumentEdges(edges);
}

/** The edges an open menu leaves for the instrument: not the menu controls, not Start. */
function instrumentEdges(edges) {
  return edges.filter((e) => !MENU_CONTROLS.has(e.name) && e.name !== 'start');
}

/** Feeds one frame of input to every instrument and routes its events. */
function playInstruments() {
  const now = nowSeconds();
  for (const ui of laneUis.values()) {
    const edges = menuInput(ui, now * 1000);
    if (!ui.logic) continue;
    // Tap-to-play only while the settings panel is open as a gamepad menu (design 7.4).
    ui.logic.setTapToPlay?.(!!ui.panel?.gamepadMenu);
    const events = ui.menuEvents || [];
    ui.menuEvents = null;
    events.push(...ui.logic.handle(edges, ui.device.controls, now));
    if (!ui.logic.handlesBackHold) events.push(...genericBackHold(ui, edges, now));
    for (const event of events) {
      if (event.type === 'action') {
        laneAction(ui, event);
        continue;
      }
      if (event.type === 'starPower') {
        ui.starPower.set(event.on, now); // visual only (R5.5)
        continue;
      }
      const channel = channelFor(ui, event.part);
      channel.handle(event, now);
      if (event.type === 'noteOn') {
        ui.highway.noteOn(event, channel.tracker, placeNote(ui.kind, event, laneColorOf(ui), laneColumns(ui)), now);
      }
    }
  }
}

/** Acts on an instrument's 'action' event. */
function laneAction(ui, event) {
  const id = settingsIdOf(ui.device);
  switch (event.action) {
    case 'openSettings':
      openSettingsByStart(ui);
      break;
    case 'tiltToggled':
      // No toast; locking (tilt off) saves the new base (R4.5.6).
      if (!event.enabled && !ui.device.isKeyboard) saveChanges(ui, rangeShiftedChange(event.base, scaleLengthOf(ui), getDeviceSettings(id).rangeOffset).changes);
      break;
    case 'rangeShifted': {
      // D-pad octave (R4.15): saved like a range locked with Back.
      const result = rangeShiftedChange(event.base, scaleLengthOf(ui), getDeviceSettings(id).rangeOffset);
      saveChanges(ui, result.changes);
      showLaneToast(ui, result.toast);
      break;
    }
    case 'dpad': {
      // D-pad effect / key / sound (R4.15): a normal settings change.
      const settings = getDeviceSettings(id);
      const result = dpadChange(settings.dpadAction, event.dir, settings, ui.instrument);
      saveChanges(ui, result.changes);
      if (result.toast) showLaneToast(ui, result.toast);
      break;
    }
    case 'resetSettings':
      resetLaneSettings(ui, !!event.full);
      break;
  }
}

function scaleLengthOf(ui) {
  return ui.logic?.options?.scale?.length || 1;
}

/** Saves device settings `changes` ({ key: value }) of a lane. */
function saveChanges(ui, changes) {
  for (const [key, value] of Object.entries(changes)) setDeviceSetting(settingsIdOf(ui.device), key, value);
}

/**
 * Start without a gamepad menu (R4.10, R2.14): opens the settings as a
 * gamepad menu; an open plain (mouse-opened) panel becomes a gamepad menu.
 * The keyboard's Backspace/Start has no menu navigation, so it toggles.
 */
function openSettingsByStart(ui) {
  const index = ui.device.index;
  if (ui.device.isKeyboard) {
    toggleSettings(index);
    return;
  }
  if (ui.panel?.gamepadMenu) return;
  if (ui.panel) closeSettings(index);
  toggleSettings(index, { byGamepad: true });
}

/**
 * Back held on an instrument without its own Back handling (drums, ...): the
 * same 'resetSettings' actions as the guitar emits (5 s, and 10 s with full).
 */
function genericBackHold(ui, edges, now) {
  const out = [];
  const add = (result) => {
    if (result === 'hold' || result === 'fullReset') out.push({ type: 'action', action: 'resetSettings', full: result === 'fullReset', time: now });
  };
  for (const e of edges) {
    if (e.name !== 'back') continue;
    if (e.type === 'pressed') ui.backHold.press(now);
    else if (e.type === 'released') add(ui.backHold.release(now));
  }
  add(ui.backHold.update(now));
  return out;
}

/**
 * Resets this controller's stored settings (only this device; global
 * settings such as language and view stay). Back held 5 s keeps the chosen
 * instrument (R4.11.2); 10 s resets it too (R4.11.3). The settings listener
 * then rebuilds or reconfigures the instrument and refreshes an open panel.
 * Ringing guitar notes were already muted by the guitar itself.
 */
function resetLaneSettings(ui, full) {
  resetDeviceSettings(settingsIdOf(ui.device), full ? undefined : { keepInstrument: true });
  showLaneToast(ui, t(full ? 'lane.fullReset' : 'lane.settingsReset'));
}

/**
 * A short message in the lane (resets, D-pad actions). One toast per lane; a
 * new one replaces the old one and restarts its timer. It fades out after
 * about 1.2 s.
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
    // Star power replaces the lane color with its glow (R5.5).
    const color = ui.starPower.color(lane.color, now);
    const area = drawLaneFrame(ctx, { ...lane, color }, {
      number: laneNumber(lane.device),
      title: t(`instrument.${ui.instrument}`),
    });
    // The debug view covers the whole lane; no need to draw its content.
    if (ui.debug) continue;
    const view = {
      device: ui.device,
      color,
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
    if (ui.starPower.visible) ui.starPower.draw(ctx, lane, now);
  }
}

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

/** Replaces the options of a top-bar select; `selected` is the chosen value. */
function fillSelect(select, values, textOf, selected) {
  select.replaceChildren(
    ...values.map((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = textOf(value);
      option.selected = value === selected;
      return option;
    }),
  );
}

function fillLanguageSelect() {
  const current = getGlobalSettings().language;
  fillSelect(languageSelect, ['auto', ...SUPPORTED_LANGUAGES], (code) => t(`lang.${code}`), current);
}

function fillViewSelect() {
  fillSelect(viewSelect, CHOICES.view, (value) => t(`view.${value}`), visualStyle);
}

/**
 * Note names (R6.3): the select is shown only when the language has its own
 * names; the active list goes to theory.js for every note name drawn.
 */
function applyNoteNames() {
  const choice = getGlobalSettings().noteNames;
  setNoteNames(noteNameList(choice));
  noteNamesPicker.hidden = !hasLanguageNoteNames();
  const naturals = (list) => [0, 2, 4, 5, 7, 9, 11].map((i) => list[i]).join(' ');
  const lists = { international: internationalNoteNames(), language: languageNoteNames() || internationalNoteNames() };
  fillSelect(noteNamesSelect, CHOICES.noteNames, (value) => naturals(lists[value]), choice);
  for (const ui of laneUis.values()) ui.panel?.refresh();
}

function onLanguageChanged() {
  document.title = t('app.title');
  applyTranslations(document);
  fillLanguageSelect();
  fillViewSelect();
  applyNoteNames();
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
  noteNamesSelect.addEventListener('change', () => {
    setGlobalSetting('noteNames', noteNamesSelect.value);
    noteNamesSelect.blur();
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
      else if (change.key === 'noteNames') applyNoteNames();
      else if (change.key === 'view') {
        visualStyle = change.value;
        fillViewSelect();
      }
    } else if (change.scope === 'device') {
      for (const ui of laneUis.values()) {
        if (settingsIdOf(ui.device) === change.id) {
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
