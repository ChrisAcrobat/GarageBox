// Experiment E: Back button tap vs. long hold, with injected time.
//
// A short press of Back is a *tap*, reported on release (so a long hold is
// not also a tap). Once Back has been held for BACK_HOLD_SECONDS a *hold* is
// reported right away, while it is still held; the release that follows is
// then ignored. cancel() forgets a pending press, e.g. while a menu owns Back:
// a release whose press was never seen (Back closed a menu) does nothing.
//
// All times are in seconds (the instruments' time base, performance.now() / 1000).

/** How long Back must be held to reset the controller's settings. */
export const BACK_HOLD_SECONDS = 5;

export class BackHold {
  constructor(holdSeconds = BACK_HOLD_SECONDS) {
    this.holdSeconds = holdSeconds;
    this.downAt = null; // time of the press that is still held, or null
    this.fired = false; // the hold was reported for the current press
  }

  /** Back went down at `time`. */
  press(time) {
    this.downAt = time;
    this.fired = false;
  }

  /** Back went up at `time`. Returns 'tap' for a short press, else null. */
  release(time) {
    const result = this.downAt !== null && !this.fired && time - this.downAt < this.holdSeconds - 1e-9 ? 'tap' : null;
    // A release at or after the hold time without an update() in between
    // still counts as a hold, never as a tap.
    const lateHold = this.downAt !== null && !this.fired && result === null ? 'hold' : null;
    this.downAt = null;
    this.fired = false;
    return result || lateHold;
  }

  /** Call every frame. Returns 'hold' once when the hold time is reached, else null. */
  update(time) {
    if (this.downAt === null || this.fired) return null;
    if (time - this.downAt >= this.holdSeconds - 1e-9) {
      this.fired = true;
      return 'hold';
    }
    return null;
  }

  /** True while a press is pending (held, hold not reported yet). */
  get pending() {
    return this.downAt !== null && !this.fired;
  }

  /** Seconds Back has been held so far (0 when not held). */
  heldFor(time) {
    return this.downAt === null ? 0 : Math.max(0, time - this.downAt);
  }

  /** Forgets the current press (a menu took over Back). */
  cancel() {
    this.downAt = null;
    this.fired = false;
  }
}
