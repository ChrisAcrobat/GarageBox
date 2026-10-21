// Controller type detection from gamepad.id (R2.5, design 3.1).
//
// Order of checks:
//   1. XInput subtype in the id (Chrome/Edge on Windows), e.g.
//      "Xbox 360 Controller (XInput STANDARD GUITAR_ALTERNATE)".
//   2. Vendor and product ID against known-devices.js. Formats:
//      Chrome: "RedOctane Guitar Hero X-plorer (Vendor: 1430 Product: 4748)"
//              (possibly "(STANDARD GAMEPAD Vendor: 1430 Product: 4748)")
//      Firefox: "1430-4748-RedOctane Guitar Hero X-plorer"
//   3. Keywords in the name.
// A stored manual instrument choice overrides the result (R2.6, R2.7); that is
// handled by the caller through the settings store.

import { findKnownDevice } from './known-devices.js';

export const ControllerType = Object.freeze({
  GUITAR: 'guitar',
  DRUM_KIT: 'drumKit',
  GAMEPAD: 'gamepad',
});

const XINPUT_SUBTYPES = Object.freeze({
  GUITAR: { type: ControllerType.GUITAR, bass: false },
  GUITAR_ALTERNATE: { type: ControllerType.GUITAR, bass: false },
  GUITAR_BASS: { type: ControllerType.GUITAR, bass: true },
  DRUM_KIT: { type: ControllerType.DRUM_KIT, bass: false },
});

// Drum keywords are checked first: some drum kits carry "Guitar Hero" in their name.
const DRUM_KEYWORDS = /drum|taiko/i;
const GUITAR_KEYWORDS = /guitar|x-?plorer/i;
const BASS_KEYWORDS = /\bbass\b/i;

function pad4(hex) {
  return hex.toLowerCase().padStart(4, '0');
}

/** Parses the USB vendor/product ID from a gamepad id, or returns null. */
export function parseVidPid(id) {
  if (typeof id !== 'string') return null;
  let m = id.match(/Vendor:\s*([0-9a-f]{1,4})\s+Product:\s*([0-9a-f]{1,4})/i);
  if (!m) m = id.match(/^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i);
  if (!m) return null;
  return { vendor: pad4(m[1]), product: pad4(m[2]) };
}

/** Formats a parsed VID/PID as "1430:4748", or null. */
export function formatVidPid(vidPid) {
  return vidPid ? `${vidPid.vendor}:${vidPid.product}` : null;
}

/**
 * Returns the XInput subtype token from an id such as
 * "Xbox 360 Controller (XInput STANDARD GUITAR_ALTERNATE)" -> "GUITAR_ALTERNATE",
 * or null when the id has no XInput part.
 */
export function parseXInputSubtype(id) {
  if (typeof id !== 'string') return null;
  const m = id.match(/\(XInput\b([^)]*)\)/i);
  if (!m) return null;
  const tokens = m[1].trim().split(/\s+/).filter(Boolean).map((s) => s.toUpperCase());
  return tokens.find((tok) => tok in XINPUT_SUBTYPES) || tokens.find((tok) => tok !== 'STANDARD') || null;
}

/**
 * Detects the controller type from gamepad.id.
 * Returns { type, source, vidPid, xinput, knownName, bass } where
 *   type:   'guitar' | 'drumKit' | 'gamepad'
 *   source: 'xinput' | 'vidpid' | 'keyword' | 'none' (which rule decided)
 *   bass:   true when the id indicates a bass guitar controller
 */
export function detectController(id) {
  const name = typeof id === 'string' ? id : '';
  const vidPid = parseVidPid(name);
  const xinput = parseXInputSubtype(name);
  const result = { type: ControllerType.GAMEPAD, source: 'none', vidPid, xinput, knownName: null, bass: false };

  if (xinput && XINPUT_SUBTYPES[xinput]) {
    return { ...result, ...XINPUT_SUBTYPES[xinput], source: 'xinput' };
  }

  if (vidPid) {
    const known = findKnownDevice(vidPid.vendor, vidPid.product);
    if (known) {
      return { ...result, type: known.type, source: 'vidpid', knownName: known.name, bass: BASS_KEYWORDS.test(name) };
    }
  }

  if (DRUM_KEYWORDS.test(name)) return { ...result, type: ControllerType.DRUM_KIT, source: 'keyword' };
  if (GUITAR_KEYWORDS.test(name)) {
    return { ...result, type: ControllerType.GUITAR, source: 'keyword', bass: BASS_KEYWORDS.test(name) };
  }
  return result;
}

/**
 * Instrument preselected for a detection result when there is no manual choice:
 * guitar controllers -> guitar (bass for bass guitars) (R2.3),
 * drum kits and regular gamepads -> drums (R2.2).
 */
export function defaultInstrumentFor(detection) {
  if (detection.type === ControllerType.GUITAR) return detection.bass ? 'bass' : 'guitar';
  return 'drums';
}
