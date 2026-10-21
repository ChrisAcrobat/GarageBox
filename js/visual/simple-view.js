// Simple view (design section 6, R5.2): the device's buttons, lit while pressed.
//
// Milestone 1 draws a placeholder: the logical controls of the device's
// mapping (fret buttons as colored circles on a guitar), followed by every
// raw button, so something visibly reacts to input. Raw axes are shown only
// in the debug view. Note names are added together with the instruments in
// milestone 2.

import { ANALOG_CONTROLS } from '../input/mappings.js';
import { withAlpha, fitText } from './lanes.js';

/** Fret colors from green to orange (R4.1). */
export const FRET_COLORS = Object.freeze(['#2fbf4a', '#e5484d', '#f5d90a', '#3e8ef7', '#f76b15']);

const FRETS = ['fret1', 'fret2', 'fret3', 'fret4', 'fret5'];

function sectionTitle(ctx, text, x, y, w) {
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fitText(ctx, text.toUpperCase(), w), x, y);
  return y + 18;
}

function drawFrets(ctx, device, x, y, w) {
  const r = Math.max(8, Math.min(26, (w - 4 * 10) / 10));
  const spacing = (w - 2 * r) / 4;
  FRETS.forEach((name, i) => {
    const c = device.controls[name];
    const cx = x + r + i * spacing;
    const cy = y + r;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = c && c.pressed ? FRET_COLORS[i] : withAlpha(FRET_COLORS[i], 0.18);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = FRET_COLORS[i];
    ctx.stroke();
    if (c && c.pressed) {
      ctx.save();
      ctx.shadowColor = FRET_COLORS[i];
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.restore();
    }
  });
  return y + 2 * r + 14;
}

/** Lays out labelled pills left to right, wrapping lines. Returns the next y. */
function drawPills(ctx, items, x, y, w, color) {
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
      // Fill level for analog controls.
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

function drawRawButtons(ctx, device, x, y, w, color) {
  const size = 24;
  const gap = 4;
  const perRow = Math.max(1, Math.floor((w + gap) / (size + gap)));
  ctx.font = '600 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  device.raw.buttons.forEach((b, i) => {
    const bx = x + (i % perRow) * (size + gap);
    const by = y + Math.floor(i / perRow) * (size + gap);
    ctx.beginPath();
    ctx.roundRect(bx, by, size, size, 4);
    ctx.fillStyle = b.pressed ? color : withAlpha(color, Math.min(0.12 + b.value * 0.6, 0.72));
    ctx.fill();
    ctx.fillStyle = b.pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(String(i), bx + size / 2, by + size / 2 + 1);
  });
  const rows = Math.ceil(device.raw.buttons.length / perRow);
  return y + rows * (size + gap) + 10;
}

/**
 * Draws the placeholder simple view into `area`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../input/gamepad-manager.js').Device} device
 * @param {{x:number,y:number,w:number,h:number}} area content area of the lane
 * @param {string} color lane color
 * @param {(key: string) => string} t translation function
 */
export function drawSimpleView(ctx, device, area, color, t) {
  const { x, w } = area;
  let y = area.y;
  const bottom = area.y + area.h;

  y = sectionTitle(ctx, t('lane.controls'), x, y, w);
  const names = Object.keys(device.mapping.controls);
  const hasFrets = FRETS.every((f) => names.includes(f));
  if (hasFrets) y = drawFrets(ctx, device, x, y, w);
  const items = names
    .filter((n) => !(hasFrets && FRETS.includes(n)))
    .map((n) => ({
      label: t(`control.${n}`),
      pressed: device.controls[n].pressed,
      value: device.controls[n].value,
      analog: ANALOG_CONTROLS.has(n),
      showValue: n === 'whammy',
    }));
  y = drawPills(ctx, items, x, y, w, color);

  if (y + 40 > bottom) return;
  y = sectionTitle(ctx, t('lane.rawButtons'), x, y, w);
  drawRawButtons(ctx, device, x, y, w, color);
}
