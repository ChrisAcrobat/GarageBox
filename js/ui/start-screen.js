// Start screen (design 7.1, R2.8).
//
// Step 1: "Click or press a key to start". The click or key press unlocks
//         audio (browsers do not count gamepad buttons as a user gesture).
//         A controller can also start with Start (or D-pad right on the
//         highlighted Start button, design 7.4); if the browser then still
//         blocks sound, the screen stays and asks for one click or key press.
// Step 2: "Press any button on a controller", shown until at least one
//         gamepad is seen; shown again if all controllers disconnect.

import { CURSOR_CLASS } from './menu-nav.js';

export class StartScreen {
  /**
   * @param {HTMLElement} root element containing [data-step="click"] and [data-step="press"]
   * @param {object} options
   * @param {() => void} options.onStart called from inside the click/key event (or after a controller start that got sound)
   * @param {() => Promise<boolean>} [options.onGamepadStart] tries to start audio without a user gesture; resolves to whether sound runs
   */
  constructor(root, { onStart, onGamepadStart }) {
    this.root = root;
    this.onStart = onStart;
    this.onGamepadStart = onGamepadStart || (async () => true);
    this.started = false;
    this.stepClick = root.querySelector('[data-step="click"]');
    this.stepPress = root.querySelector('[data-step="press"]');
    this.startButton = root.querySelector('[data-step="click"] .start-button');
    this.gestureHint = root.querySelector('[data-step="click"] .start-gesture');
    this._handler = (event) => this._start(event);
    window.addEventListener('click', this._handler, true);
    window.addEventListener('keydown', this._handler, true);
    this._show('click');
  }

  /** True while step 1 waits for the start; menu intents then go to navigate(). */
  get active() {
    return !this.started;
  }

  _start(event) {
    if (this.started) return;
    // Pure modifier keys do not count as a user gesture in all browsers.
    if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    if (event.type === 'click') event.stopPropagation();
    this._begin();
  }

  _begin() {
    this.started = true;
    window.removeEventListener('click', this._handler, true);
    window.removeEventListener('keydown', this._handler, true);
    if (this.gestureHint) this.gestureHint.hidden = true;
    this.onStart();
    this._show('press');
  }

  /**
   * Menu intent from any controller (the start screen is not tied to a lane):
   * Start, or right on the Start button (the only control), starts.
   */
  navigate(intent) {
    if (this.started || (intent !== 'start' && intent !== 'right')) return;
    this._startFromGamepad();
  }

  async _startFromGamepad() {
    if (this._pending) return;
    this._pending = true;
    let ok = false;
    try {
      ok = await this.onGamepadStart();
    } finally {
      this._pending = false;
    }
    if (this.started) return;
    if (ok) this._begin();
    else if (this.gestureHint) this.gestureHint.hidden = false;
  }

  _show(step) {
    this.step = step;
    this.stepClick.hidden = step !== 'click';
    this.stepPress.hidden = step !== 'press';
    this.root.hidden = step === 'none';
    this.root.dataset.step = step;
  }

  /**
   * Call every frame with whether any device (controller or keyboard) is
   * connected and whether a gamepad is connected (shows the gamepad cursor on
   * the Start button).
   */
  update(hasDevices, hasGamepad = false) {
    this.startButton?.classList.toggle(CURSOR_CLASS, hasGamepad && !this.started);
    if (!this.started) return;
    const want = hasDevices ? 'none' : 'press';
    if (want !== this.step) this._show(want);
  }
}
