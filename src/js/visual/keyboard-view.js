// On-screen computer keyboard (design 6, R4c.5, R4c.6).
//
// Drawn at the bottom of the keyboard lane when the keyboard instrument is
// on. Every key that plays something shows what it plays: the note name on
// the musical typing keys (following the current Shift/Alt octave), the fret
// note on 1-5 (in the fret colors), and Strum, Sustain and the octave keys.
// In Drums mode (R4c.13) the letter keys show a short drum label instead, and
// 1-5, Backspace, Shift, Alt and Space are dimmed without labels. A compact
// numpad block to the right of the bottom rows shows the numpad kit in both
// modes (R4c.14). A key lights up while it is pressed. The letter on each key
// is the US layout name of the physical key (KeyboardEvent.code), which is
// where the key sits on any layout (R4c.7).

import { noteName } from '../audio/theory.js';
import { KEY_OFFSETS } from '../instruments/keys.js';
import { FRET_COLORS, withAlpha, fitText } from './lanes.js';

const SHARP_OFFSETS = new Set([1, 3, 6, 8, 10]);

/** Rows of keys; x and w are in key units. */
const ROWS = [
  { x: 0.5, keys: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', { code: 'Backspace', w: 2.2, gap: 0.6, label: 'keys.strum' }] },
  { x: 0.9, keys: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'] },
  { x: 1.15, keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'] },
  { x: 0, keys: [{ code: 'ShiftLeft', w: 1.55, label: 'keys.octaveUp' }, 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'] },
  { x: 0, keys: [{ code: 'AltLeft', w: 1.9, label: 'keys.octaveDown' }, { code: 'Space', w: 6, gap: 0.6, label: 'keys.sustain' }] },
];
const ROW_STEP = 0.92;

/**
 * The numpad block (R4c.14): 3 x 3 plus a wide 0, beside the last three rows
 * (home row to Space), in four compact rows of that height.
 */
const NUMPAD_ROWS = [['Numpad7', 'Numpad8', 'Numpad9'], ['Numpad4', 'Numpad5', 'Numpad6'], ['Numpad1', 'Numpad2', 'Numpad3'], [{ code: 'Numpad0', w: 2 }]];
const NUMPAD_FIRST_ROW = 2;
const NUMPAD_X = 10.45;
const NUMPAD_KEY = ((ROWS.length - NUMPAD_FIRST_ROW) * ROW_STEP) / NUMPAD_ROWS.length;
const UNITS = NUMPAD_X + 3 * NUMPAD_KEY + 0.1;

function keyLetter(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return code.slice(6);
  return '';
}

/** Short label of a GM drum note (0 = none: no label). */
function drumLabel(note, t) {
  return note ? t(`drumAbbr.${note}`) : '';
}

/** Height the keyboard needs for a lane of width `w`. */
export function keyboardHeight(w) {
  const u = Math.min(w / UNITS, 52);
  return ROWS.length * u * ROW_STEP + 4;
}

/**
 * What one key of the main block shows: { label, fill, accent, playing }.
 * Drums mode (R4c.13) shows drum labels on the letter keys and dims the rest.
 */
function keyLook(key, keys, color, t) {
  const look = { label: key.label ? t(key.label) : '', fill: 'rgba(255, 255, 255, 0.07)', accent: color, playing: !!key.label };
  if (keys.drumsMode) {
    const note = keys.drumFor(key.code);
    if (note !== null) return { ...look, label: drumLabel(note, t), fill: 'rgba(255, 255, 255, 0.16)', playing: note > 0 };
    return { ...look, label: '', playing: false };
  }
  if (key.code.startsWith('Digit')) {
    const i = Number(key.code.slice(5)) - 1;
    return { label: noteName(keys.guitar.noteFor(i)), fill: withAlpha(FRET_COLORS[i], 0.22), accent: FRET_COLORS[i], playing: true };
  }
  if (key.code in KEY_OFFSETS) {
    const sharp = SHARP_OFFSETS.has(((KEY_OFFSETS[key.code] % 12) + 12) % 12);
    return { ...look, label: noteName(keys.noteFor(key.code)), fill: sharp ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.16)', playing: true };
  }
  return look;
}

/** Draws one key in the box (kx, ky, kw, kh); `u` sets the text sizes. */
function drawKey(ctx, box, look, pressed, letter, named, u) {
  const { kx, ky, kw, kh } = box;
  ctx.beginPath();
  ctx.roundRect(kx, ky, kw, kh, Math.max(3, u * 0.12));
  ctx.fillStyle = pressed ? look.accent : look.fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = pressed ? '#ffffff' : look.playing ? withAlpha(look.accent, 0.6) : 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();
  if (pressed) {
    ctx.save();
    ctx.shadowColor = look.accent;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }
  if (letter) {
    ctx.font = `600 ${Math.round(Math.max(8, u * 0.22))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = look.playing ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillText(letter, kx + u * 0.1, ky + u * 0.06);
  }
  if (look.label) {
    // Named keys (Strum, Sustain, ...) use a slightly smaller font.
    ctx.font = `700 ${Math.round(Math.max(8, u * (named ? 0.24 : 0.28)))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(fitText(ctx, look.label, kw - 4), kx + kw / 2, ky + kh * (letter ? 0.62 : 0.5));
  }
}

/**
 * Draws the on-screen keyboard with its top-left corner at (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../input/keyboard-input.js').KeyboardDevice} device
 * @param {import('../instruments/keys.js').Keys} keys the instrument (for note names and drum sounds)
 * @returns {number} the y below the keyboard
 */
export function drawKeyboard(ctx, device, keys, x, y, w, color, t) {
  const u = Math.min(w / UNITS, 52);
  const totalW = UNITS * u;
  x += Math.max(0, (w - totalW) / 2);
  const kh = u * 0.84;
  const pad = u * 0.06;
  // Shift/Alt only count while held: show the note names of the current octave.
  const down = device.down;
  ROWS.forEach((row, r) => {
    let kx = x + row.x * u;
    const ky = y + r * u * ROW_STEP;
    for (const entry of row.keys) {
      const key = typeof entry === 'string' ? { code: entry, w: 1 } : { w: 1, ...entry };
      kx += (key.gap || 0) * u;
      const kw = key.w * u - pad * 2;
      const pressed = down.has(key.code) || (key.code === 'ShiftLeft' && down.has('ShiftRight')) || (key.code === 'AltLeft' && down.has('AltRight'));
      const look = keyLook(key, keys, color, t);
      drawKey(ctx, { kx: kx + pad, ky: ky + pad, kw, kh }, look, pressed, keyLetter(key.code), !!key.label, u);
      kx += key.w * u;
    }
  });
  // The numpad kit (R4c.14), in both modes.
  const nu = NUMPAD_KEY * u;
  const top = y + NUMPAD_FIRST_ROW * u * ROW_STEP;
  NUMPAD_ROWS.forEach((row, r) => {
    let kx = x + NUMPAD_X * u;
    for (const entry of row) {
      const key = typeof entry === 'string' ? { code: entry, w: 1 } : entry;
      const note = keys.numpadDrumMap[key.code];
      const look = { label: drumLabel(note, t), fill: 'rgba(255, 255, 255, 0.16)', accent: color, playing: note > 0 };
      drawKey(ctx, { kx: kx + pad, ky: top + r * nu + pad, kw: key.w * nu - pad * 2, kh: nu - pad * 2 }, look, down.has(key.code), keyLetter(key.code), false, nu);
      kx += key.w * nu;
    }
  });
  return y + keyboardHeight(w);
}
