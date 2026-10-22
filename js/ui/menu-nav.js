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
 * (directions and Back). Start is left to the instrument, which already asks
 * the UI to open/close the settings panel.
 */
export const MENU_CONTROLS = Object.freeze(new Set([...NAV_SOURCES.up, ...NAV_SOURCES.down, ...NAV_SOURCES.left, ...NAV_SOURCES.right, ...NAV_SOURCES.back]));

export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 120;

const INTENT_OF = new Map(Object.entries(NAV_SOURCES).flatMap(([intent, names]) => names.map((n) => [n, intent])));

/** Menu intent of a logical control name, or undefined. */
export function intentFor(controlName) {
  return INTENT_OF.get(controlName);
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
 * A gamepad cursor over the controls of one menu element.
 * D-pad up/down moves between controls (wrapping), left/right changes the
 * value: selects cycle their options, number/range inputs step, checkboxes
 * toggle, and on a button right presses it.
 */
export class MenuNavigator {
  /**
   * @param {HTMLElement} root the menu element
   * @param {{ initial?: string }} [options] selector of the control the cursor starts on
   */
  constructor(root, { initial } = {}) {
    this.root = root;
    this.key = null;
    this.index = 0;
    const start = initial ? root.querySelector(initial) : null;
    const list = this.controls();
    if (start && list.includes(start)) this._set(list, list.indexOf(start));
    else if (list.length) this._set(list, 0);
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
    this.key = identity(list[this.index]);
    return list[this.index];
  }

  _set(list, index) {
    this.index = index;
    this.key = identity(list[index]);
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
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.click(); // toggles and fires input/change like a mouse click
    } else if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
      if (dir > 0) el.stepUp();
      else el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el instanceof HTMLButtonElement) {
      if (dir > 0) el.click();
    }
    // The change handler may have re-rendered the menu.
    if (this.root.isConnected) this.sync();
  }

  /** Handles 'up' | 'down' | 'left' | 'right'. Returns true if handled. */
  navigate(intent) {
    if (intent === 'up') this.move(-1);
    else if (intent === 'down') this.move(1);
    else if (intent === 'left') this.adjust(-1);
    else if (intent === 'right') this.adjust(1);
    else return false;
    return true;
  }
}
