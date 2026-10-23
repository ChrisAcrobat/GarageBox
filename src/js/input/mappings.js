// Raw gamepad button/axis indexes -> logical controls (design 3.1).
//
// Instruments never see raw indexes; they only see the logical controls
// defined here. Each logical control has a source:
//   { button: i }                    digital/analog button, value = button.value
//   { axis: i, from: a, to: b }      analog axis, value = (v - a) / (b - a), clamped to 0..1
//   { axis: i, dir: -1 | 1 }         one direction of an axis used as a button (e.g. a hat)
// Buttons use the browser's pressed flag; axes count as pressed when their
// value is above PRESS_THRESHOLD, except `tilt`, which counts as pressed only
// at TILT_PRESS_THRESHOLD or more (raw axis -0.8 or lower on the Xplorer), so
// ordinary playing angles do not show as pressed (star power uses it, R5.5).
//
// The guitar-standard indexes were confirmed with the real Xplorer on Chrome
// 155/Linux (design 9.1): frets B0, B1, B3, B2, B4; strum B12/B13; Start B9;
// Back B8; D-pad left/right B14/B15; whammy axis 2 (rests at -1); tilt axis 3
// (gradual, rests at about +0.12, inverted here). The guitar-xpad variant (no
// "standard" mapping) is still unconfirmed.

import { ControllerType } from './detect.js';

export const PRESS_THRESHOLD = 0.5;
export const TILT_PRESS_THRESHOLD = 0.9;

// Guitar on a browser that applies the "standard" mapping, e.g. Chrome on
// Windows (XInput: "GUITAR_ALTERNATE") or Chrome on Linux when the id
// contains "STANDARD GAMEPAD". XInput reports the frets as A, B, Y, X, LB,
// the strum bar as D-pad up/down, whammy as right stick X and tilt as right
// stick Y. Confirmed on Chrome/Linux with the Xplorer (design 9.1).
const GUITAR_STANDARD = {
  name: 'guitar-standard',
  controls: {
    fret1: { button: 0 },   // green  = A
    fret2: { button: 1 },   // red    = B
    fret3: { button: 3 },   // yellow = Y
    fret4: { button: 2 },   // blue   = X
    fret5: { button: 4 },   // orange = LB
    strumUp: { button: 12 },
    strumDown: { button: 13 },
    // D-pad left/right (standard layout B14/B15), confirmed on the real
    // Xplorer (Chrome/Linux). Used to change values in the menus.
    dpadLeft: { button: 14 },
    dpadRight: { button: 15 },
    whammy: { axis: 2, from: -1, to: 1 },  // rests at -1 (Xplorer on Chrome/Linux)
    tilt: { axis: 3, from: 1, to: -1 },    // inverted: on the Xplorer the axis falls when tilted up (R4.5)
    start: { button: 9 },
    back: { button: 8 },
  },
};

// Guitar without the standard mapping on Linux (xpad driver, XTYPE_XBOX360).
// Buttons follow the evdev key code order: A, B, X, Y, TL, TR, SELECT(Back),
// START, MODE, THUMBL, THUMBR. Axes follow evdev axis order: X, Y, Z, RX, RY,
// RZ, HAT0X, HAT0Y. The D-pad (strum bar) arrives as the hat axes 6/7.
const GUITAR_XPAD = {
  name: 'guitar-xpad',
  controls: {
    fret1: { button: 0 },   // green  = BTN_A
    fret2: { button: 1 },   // red    = BTN_B
    fret3: { button: 3 },   // yellow = BTN_Y
    fret4: { button: 2 },   // blue   = BTN_X
    fret5: { button: 4 },   // orange = BTN_TL
    strumUp: { axis: 7, dir: -1 },
    strumDown: { axis: 7, dir: 1 },
    // D-pad left/right as the horizontal hat axis: NOT yet confirmed on the
    // real Xplorer without the standard mapping (best guess from evdev order).
    dpadLeft: { axis: 6, dir: -1 },
    dpadRight: { axis: 6, dir: 1 },
    whammy: { axis: 3, from: -1, to: 1 },  // ABS_RX, assumed to rest at -1
    tilt: { axis: 4, from: -1, to: 1 },    // ABS_RY, may be on/off only (R4.5)
    start: { button: 7 },
    back: { button: 6 },
  },
};

// Regular gamepad with the W3C "standard" mapping.
const GAMEPAD_STANDARD = {
  name: 'gamepad-standard',
  controls: {
    faceA: { button: 0 },
    faceB: { button: 1 },
    faceX: { button: 2 },
    faceY: { button: 3 },
    shoulderL: { button: 4 },
    shoulderR: { button: 5 },
    triggerL: { button: 6 },
    triggerR: { button: 7 },
    dpadUp: { button: 12 },
    dpadDown: { button: 13 },
    dpadLeft: { button: 14 },
    dpadRight: { button: 15 },
    start: { button: 9 },
    back: { button: 8 },
  },
};

// Regular gamepad without the standard mapping: best guess using the Linux
// xpad/evdev layout described above (triggers are axes Z/RZ, D-pad is hat 6/7).
const GAMEPAD_XPAD = {
  name: 'gamepad-xpad',
  controls: {
    faceA: { button: 0 },
    faceB: { button: 1 },
    faceX: { button: 2 },
    faceY: { button: 3 },
    shoulderL: { button: 4 },
    shoulderR: { button: 5 },
    triggerL: { axis: 2, from: -1, to: 1 },
    triggerR: { axis: 5, from: -1, to: 1 },
    dpadUp: { axis: 7, dir: -1 },
    dpadDown: { axis: 7, dir: 1 },
    dpadLeft: { axis: 6, dir: -1 },
    dpadRight: { axis: 6, dir: 1 },
    start: { button: 7 },
    back: { button: 6 },
  },
};

export const MAPPINGS = Object.freeze({
  [GUITAR_STANDARD.name]: GUITAR_STANDARD,
  [GUITAR_XPAD.name]: GUITAR_XPAD,
  [GAMEPAD_STANDARD.name]: GAMEPAD_STANDARD,
  [GAMEPAD_XPAD.name]: GAMEPAD_XPAD,
});

/** Logical controls that carry a continuous 0..1 value (shown as bars). */
export const ANALOG_CONTROLS = new Set(['whammy', 'tilt', 'triggerL', 'triggerR']);

/**
 * Picks the mapping for a controller type and the browser's gamepad.mapping
 * value ('standard' or ''). Drum kits use the gamepad mapping for now.
 */
export function selectMapping(controllerType, gamepadMapping) {
  const standard = gamepadMapping === 'standard';
  if (controllerType === ControllerType.GUITAR) return standard ? GUITAR_STANDARD : GUITAR_XPAD;
  return standard ? GAMEPAD_STANDARD : GAMEPAD_XPAD;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Reads one source from raw state { buttons: [{pressed, value}], axes: [] }.
 * Returns { value: 0..1, pressed }. A button uses the browser's own pressed
 * flag; an axis counts as pressed above PRESS_THRESHOLD, or (when
 * `atLeast` is given) at `atLeast` or more.
 */
export function readSource(source, raw, atLeast = null) {
  if ('button' in source) {
    const b = raw.buttons[source.button];
    if (!b) return { value: 0, pressed: false };
    // Some digital buttons report pressed with value 0; treat them as fully pressed.
    return { value: b.pressed && !b.value ? 1 : clamp01(b.value), pressed: b.pressed };
  }
  if ('axis' in source) {
    const v = raw.axes[source.axis];
    if (typeof v !== 'number') return { value: 0, pressed: false };
    const value = 'dir' in source ? clamp01(v * source.dir) : clamp01((v - source.from) / (source.to - source.from));
    return { value, pressed: atLeast === null ? value > PRESS_THRESHOLD : value >= atLeast - 1e-9 };
  }
  return { value: 0, pressed: false };
}

/** Reads all logical controls: returns { name: { value, pressed } }. */
export function readLogical(mapping, raw) {
  const out = {};
  for (const [name, source] of Object.entries(mapping.controls)) out[name] = readSource(source, raw, name === 'tilt' ? TILT_PRESS_THRESHOLD : null);
  return out;
}

/** Human-readable description of a source, e.g. "B3" or "A7-". */
export function describeSource(source) {
  if ('button' in source) return `B${source.button}`;
  if ('dir' in source) return `A${source.axis}${source.dir < 0 ? '-' : '+'}`;
  return `A${source.axis}`;
}

/** Logical control names fed by raw button `index` in `mapping`. */
export function controlsForButton(mapping, index) {
  return Object.entries(mapping.controls).filter(([, s]) => s.button === index).map(([n]) => n);
}

/** Logical control names fed by raw axis `index` in `mapping`. */
export function controlsForAxis(mapping, index) {
  return Object.entries(mapping.controls).filter(([, s]) => s.axis === index).map(([n]) => n);
}
