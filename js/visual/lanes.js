// Lane layout and lane frame drawing (design section 6, R5.3, R5.3.1).
//
// The canvas width is split into one lane per device, side by side. Each lane
// has its own color and a header with the controller number
// (gamepad.index + 1). The lane content is drawn by a view (simple-view.js).

/** Lane colors, chosen by gamepad.index so a controller keeps its color. */
export const LANE_COLORS = Object.freeze([
  '#e5484d', // red
  '#3e8ef7', // blue
  '#30a46c', // green
  '#f5a524', // amber
  '#8e4ec6', // purple
  '#12a594', // teal
  '#e93d82', // pink
  '#f76b15', // orange
]);

/** Fret colors from green to orange (R4.1). */
export const FRET_COLORS = Object.freeze(['#2fbf4a', '#e5484d', '#f5d90a', '#3e8ef7', '#f76b15']);

/** Color of the computer keyboard's lane. */
export const KEYBOARD_COLOR = '#8b95a7';

export const HEADER_HEIGHT = 56;
const GAP = 6;

export function laneColor(index) {
  return LANE_COLORS[((index % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
}

/**
 * Splits `width` x `height` into lanes for `devices` (already in display order).
 * Returns [{ device, x, y, w, h, color }] in CSS pixels.
 */
export function computeLanes(devices, width, height) {
  const n = devices.length;
  if (!n) return [];
  const w = (width - GAP * (n + 1)) / n;
  return devices.map((device, i) => ({
    device,
    x: Math.round(GAP + i * (w + GAP)),
    y: GAP,
    w: Math.floor(w),
    h: height - GAP * 2,
    color: device.isKeyboard ? KEYBOARD_COLOR : laneColor(device.index),
  }));
}

/** Converts '#rrggbb' to 'rgba(r, g, b, a)'. */
export function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draws the lane background and header.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,h:number,color:string,device:object}} lane
 * @param {{ number: string, title: string }} labels header texts (already translated)
 * @returns {{x:number,y:number,w:number,h:number}} the content area below the header
 */
export function drawLaneFrame(ctx, lane, labels) {
  const { x, y, w, h, color } = lane;

  // Background: a dark panel tinted with the lane color, brighter at the bottom.
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, withAlpha(color, 0.06));
  bg.addColorStop(1, withAlpha(color, 0.22));
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = '#16181d';
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.stroke();

  // Header strip with the controller number (R5.3.1).
  ctx.save();
  roundRect(ctx, x, y, w, HEADER_HEIGHT, [10, 10, 0, 0]);
  ctx.fillStyle = withAlpha(color, 0.85);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // Controller numbers are big; a word such as "Keyboard" is drawn smaller.
  ctx.font = labels.number.length > 3 ? '700 20px system-ui, sans-serif' : '700 30px system-ui, sans-serif';
  ctx.fillText(labels.number, x + 14, y + HEADER_HEIGHT / 2 + 1);
  const numberWidth = ctx.measureText(labels.number).width;

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  // Leave room on the right for the HTML settings button.
  const maxTitle = Math.max(0, w - numberWidth - 14 - 14 - 52);
  ctx.fillText(fitText(ctx, labels.title, maxTitle), x + 14 + numberWidth + 12, y + HEADER_HEIGHT / 2 + 1);

  return { x: x + 10, y: y + HEADER_HEIGHT + 10, w: w - 20, h: h - HEADER_HEIGHT - 20 };
}

/** Shortens `text` with an ellipsis so it fits in `maxWidth` with the current font. */
export function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return s.length > 1 ? `${s}…` : '';
}
