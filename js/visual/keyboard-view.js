// On-screen computer keyboard (design 6, R4c.5, R4c.6).
//
// Drawn at the bottom of the keyboard lane when the keyboard instrument is
// on. Every key that plays something shows what it plays: the note name on
// the musical typing keys (following the current Shift/Alt octave), the fret
// note on 1-5 (in the fret colors), and Strum, Sustain and the octave keys.
// A key lights up while it is pressed. The letter on each key is the US
// layout name of the physical key (KeyboardEvent.code), which is where the
// key sits on any layout (R4c.7).

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
const UNITS = 11.2;

function keyLetter(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return '';
}

/** Height the keyboard needs for a lane of width `w`. */
export function keyboardHeight(w) {
  const u = Math.min(w / UNITS, 52);
  return ROWS.length * u * 0.92 + 4;
}

/**
 * Draws the on-screen keyboard with its top-left corner at (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../input/keyboard-input.js').KeyboardDevice} device
 * @param {import('../instruments/keys.js').Keys} keys the instrument (for note names)
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
    const ky = y + r * u * 0.92;
    for (const entry of row.keys) {
      const key = typeof entry === 'string' ? { code: entry, w: 1 } : { w: 1, ...entry };
      kx += (key.gap || 0) * u;
      const kw = key.w * u - pad * 2;
      const pressed = down.has(key.code) || (key.code === 'ShiftLeft' && down.has('ShiftRight')) || (key.code === 'AltLeft' && down.has('AltRight'));
      let label = key.label ? t(key.label) : '';
      let fill = 'rgba(255, 255, 255, 0.07)';
      let accent = color;
      let playing = !!key.label;
      if (key.code.startsWith('Digit')) {
        const i = Number(key.code.slice(5)) - 1;
        accent = FRET_COLORS[i];
        label = noteName(keys.guitar.noteFor(i));
        fill = withAlpha(accent, 0.22);
        playing = true;
      } else if (key.code in KEY_OFFSETS) {
        label = noteName(keys.noteFor(key.code));
        const sharp = SHARP_OFFSETS.has(((KEY_OFFSETS[key.code] % 12) + 12) % 12);
        fill = sharp ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.16)';
        playing = true;
      }
      ctx.beginPath();
      ctx.roundRect(kx + pad, ky + pad, kw, kh, Math.max(3, u * 0.12));
      ctx.fillStyle = pressed ? accent : fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = pressed ? '#ffffff' : playing ? withAlpha(accent, 0.6) : 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();
      if (pressed) {
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }
      const letter = keyLetter(key.code);
      if (letter) {
        ctx.font = `600 ${Math.round(Math.max(8, u * 0.22))}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = playing ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.25)';
        ctx.fillText(letter, kx + pad + u * 0.1, ky + pad + u * 0.06);
      }
      if (label) {
        ctx.font = `700 ${Math.round(Math.max(8, u * (key.label ? 0.24 : 0.28)))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(fitText(ctx, label, kw - 4), kx + pad + kw / 2, ky + pad + kh * (letter ? 0.62 : 0.5));
      }
      kx += key.w * u;
    }
  });
  return y + keyboardHeight(w);
}
