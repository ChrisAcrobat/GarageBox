// Gamepad navigation of menus (design 7.4).
//
// Only used while a menu (start screen, settings panel, device information
// view) is open; during normal play nothing here runs.
//
// Two parts:
//   - MenuInput (pure, no DOM): turns one device's logical control edges and
//     held state into menu intents 'up' | 'down' | 'left' | 'right' | 'back' |
//     'start', edge-triggered with key repeat while a direction is held.
//   - MenuNavigator (DOM): a per-menu "gamepad cursor" over the menu's
//     controls. It does not move the browser's own focus, so several lanes can
//     each have their own cursor at the same time and the computer keyboard
//     and mouse keep working as before.
// On a controller detected as a guitar the directions are turned 90 degrees
// clockwise before they reach the cursor (rotateIntent(), R2.12).

/** Logical controls (of any mapping) that act as each menu intent. */
export const NAV_SOURCES = Object.freeze({
  up: ['dpadUp', 'strumUp'],
  down: ['dpadDown', 'strumDown'],
  left: ['dpadLeft'],
  right: ['dpadRight'],
  back: ['back'],
  start: ['start'],
});

/** Intents that repeat while held. */
const REPEATING = ['up', 'down', 'left', 'right'];

/**
 * Logical controls taken away from the instrument while its menu is open
 * (directions and Back). Start is routed by main.js: in a gamepad menu it
 * activates the control under the cursor, otherwise it reaches the instrument.
 */
export const MENU_CONTROLS = Object.freeze(new Set([...NAV_SOURCES.up, ...NAV_SOURCES.down, ...NAV_SOURCES.left, ...NAV_SOURCES.right, ...NAV_SOURCES.back]));

export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 120;

const INTENT_OF = new Map(Object.entries(NAV_SOURCES).flatMap(([intent, names]) => names.map((n) => [n, intent])));

/** Menu intent of a logical control name, or undefined. */
export function intentFor(controlName) {
  return INTENT_OF.get(controlName);
}

const ROTATED = Object.freeze({ right: 'down', left: 'up', up: 'right', down: 'left' });

/**
 * A menu intent turned 90 degrees clockwise for a guitar controller (R2.12):
 * right = next control, left = previous control, up = value forwards, down =
 * value backwards. 'back' and 'start' are unchanged.
 */
export function rotateIntent(intent) {
  return ROTATED[intent] ?? intent;
}

/**
 * True when `device`'s menus use the rotated directions: a controller
 * detected as a guitar, whatever it plays; not a regular gamepad in
 * guitar/bass mode and not the computer keyboard.
 */
export function menuRotated(device) {
  return !!device && !device.isKeyboard && device.detection?.type === 'guitar';
}

/** Edge-triggered menu intents with simple key repeat for one device. */
export class MenuInput {
  constructor({ delay = REPEAT_DELAY_MS, interval = REPEAT_INTERVAL_MS } = {}) {
    this.delay = delay;
    this.interval = interval;
    this.reset();
  }

  /** Forgets all held directions (call while no menu is open). */
  reset() {
    /** intent -> time (ms) of the next repeat */
    this.next = new Map();
  }

  /**
   * @param {Array<{name:string,type:string}>} edges logical control edges of this frame
   * @param {Record<string,{pressed:boolean}>} controls current logical state
   * @param {number} nowMs time in milliseconds
   * @returns {string[]} intents, in edge order, then repeats
   */
  update(edges, controls, nowMs) {
    const out = [];
    for (const e of edges || []) {
      if (e.type !== 'pressed') continue;
      const intent = intentFor(e.name);
      if (!intent || out.includes(intent)) continue; // e.g. strum up + D-pad up on one button
      out.push(intent);
      if (REPEATING.includes(intent)) this.next.set(intent, nowMs + this.delay);
    }
    for (const intent of REPEATING) {
      if (!this.next.has(intent)) continue;
      const held = NAV_SOURCES[intent].some((n) => controls?.[n]?.pressed);
      if (!held) {
        this.next.delete(intent);
        continue;
      }
      if (nowMs >= this.next.get(intent) && !out.includes(intent)) {
        out.push(intent);
        this.next.set(intent, nowMs + this.interval);
      }
    }
    return out;
  }
}

/** Index moved by `dir` within `count` items, wrapping around. */
export function wrapIndex(index, count, dir) {
  if (count <= 0) return -1;
  return (((index + dir) % count) + count) % count;
}

const CONTROL_SELECTOR = 'select, input:not([type="hidden"]), button';

/** CSS class of the gamepad cursor. */
export const CURSOR_CLASS = 'gamepad-focus';

/** Stable identity of a control across re-renders (fields are rebuilt on every refresh). */
function identity(el) {
  if (el.dataset.key || el.dataset.nav) return el.dataset.key || el.dataset.nav;
  const classes = [...el.classList].filter((c) => c !== CURSOR_CLASS).join(' ');
  return classes || el.tagName;
}

/**
 * Remembered highlight (R2.12.1): memory key → identity of the control last
 * under the cursor. Page session only (never saved), so a reload starts at
 * the top; a settings reset does not touch it.
 */
const rememberedControls = new Map();

/** The control identity remembered under `memoryKey`, or undefined. */
export function rememberedControl(memoryKey) {
  return rememberedControls.get(memoryKey);
}

/** Forgets every remembered control (as a page reload; used by the tests). */
export function clearRememberedControls() {
  rememberedControls.clear();
}

/**
 * A gamepad cursor over the controls of one menu element (R2.12).
 * D-pad up/down moves between controls (wrapping), left/right changes the
 * value (selects cycle their options, number/range inputs step and stop at
 * their min/max) and Start activates the control: it toggles a checkbox or
 * presses a button. Each action has one button: left/right do nothing on
 * checkboxes and buttons, Start does nothing on selects and number fields.
 */
export class MenuNavigator {
  /**
   * @param {HTMLElement} root the menu element
   * @param {{ initial?: string, memoryKey?: string }} [options] `initial`:
   *   selector of the control the cursor starts on; `memoryKey`: start on, and
   *   keep remembering, the control last highlighted under this key (R2.12.1)
   */
  constructor(root, { initial, memoryKey } = {}) {
    this.root = root;
    this.memoryKey = memoryKey ?? null;
    this.key = null;
    this.index = 0;
    const list = this.controls();
    const remembered = rememberedControl(this.memoryKey); // undefined without a memory key
    const start = (remembered !== undefined && list.find((el) => identity(el) === remembered)) || (initial ? root.querySelector(initial) : null);
    if (start && list.includes(start)) this._set(list, list.indexOf(start));
    else if (list.length) this._set(list, 0);
  }

  /** Sets the identity under the cursor and remembers it under the memory key. */
  _setKey(key) {
    this.key = key;
    if (this.memoryKey !== null) rememberedControls.set(this.memoryKey, key);
  }

  /** The menu's usable controls in document order. */
  controls() {
    return [...this.root.querySelectorAll(CONTROL_SELECTOR)].filter((el) => !el.disabled && !el.closest('[hidden]'));
  }

  /** The control under the cursor (re-found after a re-render), or null. */
  current() {
    const list = this.controls();
    if (!list.length) return null;
    const byKey = list.find((el) => identity(el) === this.key);
    if (byKey) {
      this.index = list.indexOf(byKey);
      return byKey;
    }
    this.index = Math.min(this.index, list.length - 1);
    this._setKey(identity(list[this.index]));
    return list[this.index];
  }

  _set(list, index) {
    this.index = index;
    this._setKey(identity(list[index]));
    this.sync();
  }

  /** Re-applies the cursor highlight (call after the menu re-rendered). */
  sync() {
    const el = this.current();
    for (const other of this.root.querySelectorAll(`.${CURSOR_CLASS}`)) if (other !== el) other.classList.remove(CURSOR_CLASS);
    el?.classList.add(CURSOR_CLASS);
    return el;
  }

  /** Moves the cursor by dir (−1 up, +1 down). */
  move(dir) {
    const list = this.controls();
    if (!list.length) return;
    this.current();
    this._set(list, wrapIndex(this.index, list.length, dir));
    this.current()?.scrollIntoView?.({ block: 'nearest' });
  }

  /** Changes the value of the control under the cursor by dir (−1 left, +1 right). */
  adjust(dir) {
    const el = this.current();
    if (!el) return;
    if (el instanceof HTMLSelectElement) {
      if (!el.options.length) return;
      el.selectedIndex = wrapIndex(el.selectedIndex, el.options.length, dir);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
      if (dir > 0) el.stepUp(); // stops at max/min, no wrap
      else el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The change handler may have re-rendered the menu.
    if (this.root.isConnected) this.sync();
  }

  /** Start: toggles a checkbox or presses a button under the cursor; nothing on other controls. */
  activate() {
    const el = this.current();
    if (!el) return;
    const checkbox = el instanceof HTMLInputElement && el.type === 'checkbox';
    if (checkbox || el instanceof HTMLButtonElement) el.click(); // fires input/change like a mouse click
    if (this.root.isConnected) this.sync();
  }

  /** Handles 'up' | 'down' | 'left' | 'right' | 'start'. Returns true if handled. */
  navigate(intent) {
    if (intent === 'up') this.move(-1);
    else if (intent === 'down') this.move(1);
    else if (intent === 'left') this.adjust(-1);
    else if (intent === 'right') this.adjust(1);
    else if (intent === 'start') this.activate();
    else return false;
    return true;
  }
}
