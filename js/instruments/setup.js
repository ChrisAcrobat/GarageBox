// Builds an instrument and its sound configuration from a device and its
// settings (design 4, 5, 7.2). Keeps main.js free of instrument details.

import { Guitar, GAMEPAD_GUITAR_CONTROLS } from './guitar.js';
import { guitarRootMidi, scaleNotes } from '../audio/theory.js';
import { BRIGHTNESS_VALUES } from '../settings/store.js';

/** True for instruments that use the guitar logic (design 4.2, R2.10). */
export function isGuitarLike(instrument) {
  return instrument === 'guitar' || instrument === 'bass';
}

/** Guitar options from device settings; bass is one octave lower (R2.10). */
export function guitarOptions(settings, instrument, { gamepad = false } = {}) {
  const bass = instrument === 'bass';
  const root = guitarRootMidi(settings.root) - (bass ? 12 : 0);
  return {
    notes: scaleNotes(root, settings.scale, 5),
    fade: settings.fadeMs / 1000,
    controlNames: gamepad ? GAMEPAD_GUITAR_CONTROLS : null,
  };
}

/**
 * Sound configuration of a guitar-like instrument. The bass sound is the
 * same plucked string with a darker tone and a longer decay.
 */
export function guitarSound(settings, instrument) {
  const bass = instrument === 'bass';
  const brightness = BRIGHTNESS_VALUES[settings.brightness] ?? 0.55;
  return {
    source: 'pluck',
    decay: settings.decay * (bass ? 1.5 : 1),
    brightness: bass ? brightness * 0.6 : brightness,
  };
}

/**
 * Creates the instrument for a device.
 * Returns { instrument, sound } or null when the instrument has no logic yet.
 */
export function createInstrument(device, instrument, settings) {
  if (isGuitarLike(instrument)) {
    const gamepad = device.detection.type !== 'guitar';
    return {
      instrument: new Guitar(guitarOptions(settings, instrument, { gamepad })),
      sound: guitarSound(settings, instrument),
    };
  }
  return null;
}
