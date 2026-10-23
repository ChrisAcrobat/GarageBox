// Back button tap vs. long holds, with injected time (R4.11 - R4.11.3, design 4.2).
//
// A short press of Back is a *tap*, reported on release (so a long hold is
// never also a tap). While Back is held, update() reports the hold tiers as
// soon as they are reached: 'hold' once at BACK_HOLD_SECONDS (reset the
// controller's settings, keeping the instrument) and 'fullReset' once at
// BACK_FULL_RESET_SECONDS (reset everything). A single frame that jumps past
// the full-reset time reports only 'fullReset' (it includes the 5 s reset).
// A release only catches up a tier that was reached but not reported yet (a
// late frame); after a reported tier it returns nothing. cancel() forgets a
// pending press, e.g. while a menu owns Back: a release whose press was never
// seen (Back closed a menu) does nothing.
//
// All times are in seconds (the instruments' time base, performance.now() / 1000).

/** How long Back must be held to reset the controller's settings (R4.11.2). */
export const BACK_HOLD_SECONDS = 5;
/** How long Back must be held for a full reset, instrument included (R4.11.3). */
export const BACK_FULL_RESET_SECONDS = 10;

const EPSILON = 1e-9;

export class BackHold {
  constructor(holdSeconds = BACK_HOLD_SECONDS, fullResetSeconds = BACK_FULL_RESET_SECONDS) {
    this.holdSeconds = holdSeconds;
    this.fullResetSeconds = fullResetSeconds;
    this.downAt = null; // time of the press that is still held, or null
    this.level = 0; // tiers reported for the current press: 0 none, 1 hold, 2 full reset
  }

  /** Back went down at `time`. */
  press(time) {
    this.downAt = time;
    this.level = 0;
  }

  /** The tier reached at `time` and not reported yet, or null. */
  _tier(time) {
    const held = time - this.downAt;
    if (held >= this.fullResetSeconds - EPSILON && this.level < 2) return 'fullReset';
    if (held >= this.holdSeconds - EPSILON && this.level < 1) return 'hold';
    return null;
  }

  _report(tier) {
    if (tier === 'fullReset') this.level = 2;
    else if (tier === 'hold') this.level = 1;
    return tier;
  }

  /**
   * Back went up at `time`. Returns 'tap' for a press shorter than the hold
   * time, a tier that was reached but not reported yet, else null. Always
   * forgets the press.
   */
  release(time) {
    if (this.downAt === null) return null;
    const held = time - this.downAt;
    const result = held < this.holdSeconds - EPSILON ? 'tap' : this._tier(time);
    this.cancel();
    return result;
  }

  /** Call every frame. Returns 'hold' or 'fullReset' once when that tier is reached, else null. */
  update(time) {
    if (this.downAt === null) return null;
    return this._report(this._tier(time));
  }

  /** True while a press is held and the full reset has not been reported. */
  get pending() {
    return this.downAt !== null && this.level < 2;
  }

  /** Seconds Back has been held so far (0 when not held). */
  heldFor(time) {
    return this.downAt === null ? 0 : Math.max(0, time - this.downAt);
  }

  /** Forgets the current press (a menu took over Back). */
  cancel() {
    this.downAt = null;
    this.level = 0;
  }
}
