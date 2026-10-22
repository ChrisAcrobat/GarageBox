// Simple view (design section 6, R5.1, R5.2): the device's buttons, lit while
// pressed, and the names of the notes that ring.
//
// Guitar and bass: five fret buttons with the note name of each fret below
// it; a fret glows while its note rings, fading with the note's level. Below
// that, the names of all ringing notes, and pills for the other controls
// (strum, whammy with its value 0.00-1.00, tilt, Start, Back). Analog
// controls fill smoothly and are never lit by the press threshold. Raw
// buttons and axes are only shown in the debug view (9.1).
//
// Drums: one pad per mapped control with the drum's name, flashing on every
// hit with a brightness from the hit's velocity.
//
// Keyboard: the guitar frets of keys 1-5, the ringing notes and the
// on-screen keyboard (keyboard-view.js).

import { ANALOG_CONTROLS } from '../input/mappings.js';
import { noteName } from '../audio/theory.js';
import { FRET_COLORS, withAlpha, fitText } from './lanes.js';
import { drawKeyboard, keyboardHeight } from './keyboard-view.js';

export { FRET_COLORS };

export const FRETS = Object.freeze(['fret1', 'fret2', 'fret3', 'fret4', 'fret5']);

export function sectionTitle(ctx, text, x, y, w) {
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fitText(ctx, text.toUpperCase(), w), x, y);
  return y + 18;
}

/**
 * Draws five fret buttons in a row.
 * @param {{held:boolean, level:number, label:string}[]} frets
 * @returns {number} next y
 */
export function drawFretRow(ctx, frets, x, y, w, maxRadius = 30) {
  const r = Math.max(8, Math.min(maxRadius, (w - 4 * 10) / 10));
  // Keep the buttons together in wide lanes, centered.
  const rowWidth = Math.min(w, 10 * r + 4 * 1.4 * r);
  x += (w - rowWidth) / 2;
  const spacing = (rowWidth - 2 * r) / 4;
  frets.forEach((fret, i) => {
    const cx = x + r + i * spacing;
    const cy = y + r;
    const color = FRET_COLORS[i];
    // Ringing glow, fading with the note's level.
    if (fret.level > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3 + 6 * fret.level, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(color, 0.15 + 0.45 * fret.level);
      ctx.shadowColor = color;
      ctx.shadowBlur = 24 * fret.level;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fret.held ? color : withAlpha(color, 0.18);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (fret.label) {
      ctx.font = `700 ${Math.round(Math.max(10, Math.min(16, r * 0.62)))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = fret.level > 0.01 || fret.held ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(fret.label, cx, cy + r + 6);
    }
  });
  return y + 2 * r + (frets.some((f) => f.label) ? 30 : 14);
}

/** Lays out labelled pills left to right, wrapping lines. Returns the next y. */
export function drawPills(ctx, items, x, y, w, color) {
  const h = 26;
  const padX = 10;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let cx = x;
  let cy = y;
  for (const item of items) {
    const label = fitText(ctx, item.label, w - 2 * padX);
    const pw = Math.min(w, ctx.measureText(label).width + 2 * padX + (item.showValue ? 44 : 0));
    if (cx + pw > x + w && cx > x) {
      cx = x;
      cy += h + 6;
    }
    ctx.beginPath();
    ctx.roundRect(cx, cy, pw, h, 6);
    // Analog controls show their level only through the fill bar, so the pill
    // does not jump to fully lit when the value passes the press threshold.
    const lit = item.pressed && !item.analog;
    ctx.fillStyle = lit ? color : 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    if (item.analog) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = withAlpha(color, 0.45);
      ctx.fillRect(cx, cy, pw * item.value, h);
      ctx.restore();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = item.pressed ? color : 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();
    ctx.fillStyle = lit ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(label, cx + padX, cy + h / 2 + 1);
    if (item.showValue) {
      // Whammy prints its value 0.00-1.00 next to the fill bar.
      ctx.textAlign = 'right';
      ctx.fillText(item.value.toFixed(2), cx + pw - padX, cy + h / 2 + 1);
      ctx.textAlign = 'left';
    }
    cx += pw + 6;
  }
  return cy + h + 14;
}

/** Pills for the device's logical controls, except the ones in `skip`. */
export function controlPills(device, t, skip = new Set()) {
  return Object.keys(device.mapping.controls)
    .filter((n) => !skip.has(n))
    .map((n) => ({
      label: t(`control.${n}`),
      pressed: device.controls[n].pressed,
      value: device.controls[n].value,
      analog: ANALOG_CONTROLS.has(n),
      showValue: n === 'whammy',
    }));
}

/** Big names of ringing notes, brightness following each note's level. Returns next y. */
export function drawRingingNotes(ctx, voices, x, y, w, colorFor) {
  const sorted = [...voices].sort((a, b) => a.midi - b.midi);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cx = x;
  let cy = y;
  for (const v of sorted) {
    const label = noteName(v.midi);
    const lw = ctx.measureText(label).width + 14;
    if (cx + lw > x + w && cx > x) {
      cx = x;
      cy += 30;
    }
    ctx.globalAlpha = Math.max(0.2, Math.min(1, v.level * 1.4));
    ctx.fillStyle = colorFor(v);
    ctx.fillText(label, cx, cy);
    ctx.globalAlpha = 1;
    cx += lw;
  }
  return cy + 34;
}

/** Fret states for drawing, from the guitar logic and its voice levels. */
export function guitarFretStates(guitar, tracker, now) {
  return guitar.frets.map((fret, i) => ({
    held: fret.held,
    level: fret.voiceId !== null ? tracker.level(fret.voiceId, now) : 0,
    label: noteName(guitar.noteFor(i)),
  }));
}

/**
 * Draws the simple view of one lane into `area`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} lane lane state from main.js: { device, color, kind, instrument, channels }
 * @param {{x:number,y:number,w:number,h:number}} area content area of the lane
 * @param {(key: string, params?: object) => string} t translation function
 * @param {number} now seconds
 */
export function drawSimpleView(ctx, lane, area, t, now) {
  const { device, color, instrument } = lane;
  const { x, w } = area;
  let y = area.y;

  if (lane.kind === 'guitar' && instrument) {
    const tracker = lane.channels.main.tracker;
    y = sectionTitle(ctx, t('lane.frets'), x, y, w);
    y = drawFretRow(ctx, guitarFretStates(instrument, tracker, now), x, y, w);
    y = sectionTitle(ctx, t('lane.ringing'), x, y, w);
    y = drawRingingNotes(ctx, tracker.active(now), x, y, w, (v) => FRET_COLORS[v.column] || color);
    const fretControls = new Set(Object.keys(device.mapping.controls).filter((n) => instrument.reverse[n]?.startsWith('fret')));
    y = sectionTitle(ctx, t('lane.controls'), x, y, w);
    drawPills(ctx, controlPills(device, t, fretControls), x, y, w, color);
    return;
  }

  if (lane.kind === 'drums' && instrument) {
    y = sectionTitle(ctx, t('lane.pads'), x, y, w);
    y = drawDrumPads(ctx, instrument, x, y, w, area.y + area.h - y, color, t, now);
    return;
  }

  if (lane.kind === 'keys' && instrument) {
    const kbH = keyboardHeight(w);
    const guitarTracker = lane.channels.guitar.tracker;
    y = sectionTitle(ctx, t('lane.frets'), x, y, w);
    y = drawFretRow(ctx, guitarFretStates(instrument.guitar, guitarTracker, now), x, y, Math.min(w, 340), 20);
    y = sectionTitle(ctx, t('lane.ringing'), x, y, w);
    const voices = [
      ...lane.channels.main.tracker.active(now).map((v) => ({ ...v, color })),
      ...guitarTracker.active(now).map((v) => ({ ...v, color: FRET_COLORS[v.column] })),
    ];
    drawRingingNotes(ctx, voices, x, y, w, (v) => (v.color === color ? '#ffffff' : v.color));
    drawKeyboard(ctx, device, instrument, x, Math.max(y + 40, area.y + area.h - kbH), w, color, t);
    return;
  }

  // Fallback: the logical controls.
  y = sectionTitle(ctx, t('lane.controls'), x, y, w);
  drawPills(ctx, controlPills(device, t), x, y, w, color);
}

/** Drum pads in a grid; each flashes on a hit. Returns the next y. */
export function drawDrumPads(ctx, drums, x, y, w, maxH, color, t, now) {
  const n = drums.pads.length;
  if (!n) return y;
  const cols = Math.max(1, Math.min(4, Math.floor(w / 110)));
  const rows = Math.ceil(n / cols);
  const gap = 8;
  const pw = (w - gap * (cols - 1)) / cols;
  const ph = Math.max(44, Math.min(90, (maxH - gap * (rows - 1)) / rows));
  drums.pads.forEach((pad, i) => {
    const px = x + (i % cols) * (pw + gap);
    const py = y + Math.floor(i / cols) * (ph + gap);
    const flash = Math.exp(-(now - pad.lastHit) / 0.18) * (0.35 + 0.65 * (pad.velocity / 127));
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    if (flash > 0.01) {
      ctx.save();
      ctx.fillStyle = withAlpha(color, Math.min(1, flash));
      ctx.shadowColor = color;
      ctx.shadowBlur = 20 * flash;
      ctx.fill();
      ctx.restore();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(color, 0.5);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, t(`drum.${pad.note}`), pw - 10), px + pw / 2, py + ph / 2 - 8);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(fitText(ctx, t(`control.${pad.control}`), pw - 10), px + pw / 2, py + ph / 2 + 12);
  });
  return y + rows * (ph + gap) + 6;
}
