// Start screen (design 7.1, R2.8).
//
// Step 1: "Click or press a key to start". The click or key press unlocks
//         audio (browsers do not count gamepad buttons as a user gesture).
// Step 2: "Press any button on a controller", shown until at least one
//         gamepad is seen; shown again if all controllers disconnect.

export class StartScreen {
  /**
   * @param {HTMLElement} root element containing [data-step="click"] and [data-step="press"]
   * @param {{ onStart: () => void }} options onStart is called from inside the click/key event
   */
  constructor(root, { onStart }) {
    this.root = root;
    this.onStart = onStart;
    this.started = false;
    this.stepClick = root.querySelector('[data-step="click"]');
    this.stepPress = root.querySelector('[data-step="press"]');
    this._handler = (event) => this._start(event);
    window.addEventListener('click', this._handler, true);
    window.addEventListener('keydown', this._handler, true);
    this._show('click');
  }

  _start(event) {
    if (this.started) return;
    // Pure modifier keys do not count as a user gesture in all browsers.
    if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    this.started = true;
    window.removeEventListener('click', this._handler, true);
    window.removeEventListener('keydown', this._handler, true);
    if (event.type === 'click') event.stopPropagation();
    this.onStart();
    this._show('press');
  }

  _show(step) {
    this.step = step;
    this.stepClick.hidden = step !== 'click';
    this.stepPress.hidden = step !== 'press';
    this.root.hidden = step === 'none';
    this.root.dataset.step = step;
  }

  /** Call every frame (or on device changes) with whether any controller is connected. */
  update(hasDevices) {
    if (!this.started) return;
    const want = hasDevices ? 'none' : 'press';
    if (want !== this.step) this._show(want);
  }
}
