// Star power (R5.5, design 6): the trigger and the confetti/light effect.
//
// StarPowerTrigger is used by the guitar instrument (guitar.js) each frame.
// Star power starts when it is not active, `tilt` is pressed (mapped >= 0.9,
// design 3.1) and the whammy deflection is >= STAR_POWER_WHAMMY in the same
// frame. It stays on while `tilt` is pressed. When `tilt` is released an
// 8 s countdown starts; pressing `tilt` again cancels it (it starts again
// from 8 s at the next release). When it runs out star power ends; it only
// starts again through the start trigger. The countdown is never drawn.
//
// StarPowerVisual is kept per lane by main.js and fed the instrument's
// `starPower` events: the lane color is replaced by a blue-white glow (fades
// in over 0.3 s, out over 1 s) and confetti falls over the lane. Star power
// is visual only; the audio engine ignores the events.
//
// Times are in seconds.

import { FRET_COLORS } from './lanes.js';

/** Whammy deflection needed (with tilt pressed) to start star power. */
export const STAR_POWER_WHAMMY = 0.95;
/** Seconds star power lasts after `tilt` is released. */
export const STAR_POWER_COUNTDOWN = 8;
/** The glow color that replaces the lane color. */
export const STAR_POWER_COLOR = '#bfe6ff';

const EPSILON = 1e-9;
const GLOW_IN = 0.3;
const GLOW_OUT = 1;

export class StarPowerTrigger {
  constructor() {
    this.active = false;
    this.releasedAt = null; // start of the countdown, or null while tilt is pressed
  }

  /**
   * One frame: `tiltPressed` (tilt's on/off state), `whammy` (deflection
   * 0..1). Returns true when star power starts, false when it ends, else null.
   */
  update(tiltPressed, whammy, time) {
    if (!this.active) {
      if (tiltPressed && whammy >= STAR_POWER_WHAMMY) {
        this.active = true;
        this.releasedAt = null;
        return true;
      }
      return null;
    }
    if (tiltPressed) {
      this.releasedAt = null; // cancels a running countdown
      return null;
    }
    if (this.releasedAt === null) this.releasedAt = time;
    if (time - this.releasedAt >= STAR_POWER_COUNTDOWN - EPSILON) {
      this.active = false;
      this.releasedAt = null;
      return false;
    }
    return null;
  }

  reset() {
    this.active = false;
    this.releasedAt = null;
  }
}

/** Mixes two '#rrggbb' colors (k = 0: a, 1: b). */
export function mixColor(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

const CONFETTI_COLORS = [...FRET_COLORS, '#ffffff'];

export class StarPowerVisual {
  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.on = false;
    this.changedAt = -Infinity;
    this.glowAtChange = 0;
    this.pieces = [];
    this.lastTime = null;
    this.spawned = 0;
  }

  /** Feeds a `starPower` event (`now` in the view's time base). */
  set(on, now) {
    on = !!on;
    if (on === this.on) return;
    this.glowAtChange = this.glow(now);
    this.on = on;
    this.changedAt = now;
    if (on) this.spawned = 0;
  }

  /** Glow amount 0..1 at `now`. */
  glow(now) {
    const dt = now - this.changedAt;
    if (this.on) return Math.min(1, this.glowAtChange + dt / GLOW_IN);
    return Math.max(0, this.glowAtChange - dt / GLOW_OUT);
  }

  /** The lane color to draw with: the glow mixed into `color`. */
  color(color, now) {
    const k = this.glow(now);
    return k > 0 ? mixColor(color, STAR_POWER_COLOR, k) : color;
  }

  /** True while there is anything to draw. */
  get visible() {
    return this.on || this.pieces.length > 0;
  }

  _spawn(area, count) {
    for (let i = 0; i < count; i++) {
      this.pieces.push({
        x: area.x + Math.random() * area.w,
        y: area.y - Math.random() * 20,
        vx: (Math.random() - 0.5) * 40,
        vy: this.reducedMotion ? 20 + Math.random() * 20 : 40 + Math.random() * 80,
        a: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * (this.reducedMotion ? 2 : 10),
        w: 4 + Math.random() * 4,
        h: 2 + Math.random() * 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      });
    }
    this.spawned += count;
  }

  /** Moves and draws the confetti over the lane rectangle `area`. */
  draw(ctx, area, now) {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    if (this.on) {
      const burst = this.reducedMotion ? 30 : 150;
      const since = now - this.changedAt;
      if (since < 1.5) {
        const target = Math.ceil(burst * Math.min(1, since / 1.5));
        if (target > this.spawned) this._spawn(area, target - this.spawned);
      } else if (!this.reducedMotion) {
        // A lower, steady rate while star power lasts (about 30 per second).
        if (Math.random() < dt * 30) this._spawn(area, 1);
      }
    }
    if (!this.pieces.length) return;
    const gravity = this.reducedMotion ? 5 : 60;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    this.pieces = this.pieces.filter((p) => {
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (p.y > area.y + area.h + 10 || p.x < area.x - 10 || p.x > area.x + area.w + 10) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      return true;
    });
    ctx.restore();
  }
}
