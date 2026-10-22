// Simple view (design section 6, R5.1, R5.2): the device's buttons, lit while
// pressed, and the names of the notes that ring.
//
// Guitar and bass: five fret buttons with the note name of each fret below
// it; a fret glows while its note rings, fading with the note's level. Below
// that, the names of all ringing notes, and pills for the other controls
// (strum, whammy with its value 0.00-1.00, tilt, Start, Back). Analog
// controls fill smoothly and are never lit by the press threshold. Raw
// buttons and axes are only shown in the debug view (9.1).

import { ANALOG_CONTROLS } from '../input/mappings.js';
import { noteName } from '../audio/theory.js';
import { withAlpha, fitText } from './lanes.js';

/** Fret colors from green to orange (R4.1). */
export const FRET_COLORS = Object.freeze(['#2fbf4a', '#e5484d', '#f5d90a', '#3e8ef7', '#f76b15']);

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

  // Instruments without their own view yet: the logical controls.
  y = sectionTitle(ctx, t('lane.controls'), x, y, w);
  drawPills(ctx, controlPills(device, t), x, y, w, color);
}
