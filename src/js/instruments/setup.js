// Builds an instrument and its sound configuration from a device and its
// settings (design 4, 5, 7.2). Keeps main.js free of instrument details.
//
// createInstrument() returns { instrument, sounds } where `sounds` has one
// channel configuration per part: `main` for every instrument, plus `guitar`
// for the keyboard's guitar emulation on keys 1-5 (R4c.3).

import { Guitar, GAMEPAD_GUITAR_CONTROLS } from './guitar.js';
import { Drums } from './drums.js';
import { Keys } from './keys.js';
import { guitarRootMidi, scaleNotes, SCALES } from '../audio/theory.js';
import { BRIGHTNESS_VALUES } from '../settings/store.js';

/** Default General MIDI program (0-based) per instrument when the MIDI source is used. */
export const DEFAULT_PROGRAMS = Object.freeze({
  guitar: 27, // Electric Guitar (clean)
  bass: 33, // Electric Bass (finger)
  keys: 0, // Acoustic Grand Piano (R4c.11)
});

/** Default sound source per instrument (R3.5, R4c.11). */
export const DEFAULT_SOURCES = Object.freeze({
  guitar: 'pluck',
  bass: 'pluck',
  drums: 'midi',
  keys: 'midi',
});

/** Sound sources an instrument can use. Drums only have the MIDI drum kit. */
export const SOURCES_FOR = Object.freeze({
  guitar: ['pluck', 'midi'],
  bass: ['pluck', 'midi'],
  drums: ['midi'],
  keys: ['midi', 'pluck'],
});

/** True for instruments that use the guitar logic (design 4.2, R2.10). */
export function isGuitarLike(instrument) {
  return instrument === 'guitar' || instrument === 'bass';
}

/** 'guitar' for guitar and bass, else the instrument name. Used to pick views and settings. */
export function instrumentKind(instrument) {
  return isGuitarLike(instrument) ? 'guitar' : instrument;
}

export function resolveSource(settings, instrument) {
  const allowed = SOURCES_FOR[instrument] || ['midi'];
  return allowed.includes(settings.source) ? settings.source : DEFAULT_SOURCES[instrument];
}

export function resolveProgram(settings, instrument) {
  return settings.program >= 0 ? settings.program : DEFAULT_PROGRAMS[instrument] ?? 0;
}

/** Guitar options from device settings; bass is one octave lower (R2.10). */
export function guitarOptions(settings, instrument, { gamepad = false } = {}) {
  const bass = instrument === 'bass';
  const root = guitarRootMidi(settings.root) - (bass ? 12 : 0);
  return {
    notes: scaleNotes(root, settings.scale, 5),
    rootMidi: root,
    scale: [...(SCALES[settings.scale] || SCALES.minorPentatonic)],
    fade: settings.fadeMs / 1000,
    whammy: settings.whammy ?? 'bend',
    tilt: settings.tilt ?? 'off',
    bendRange: settings.bendRange ?? -2,
    tiltSmoothing: (settings.tiltSmoothing ?? 80) / 1000,
    rangeOffset: settings.rangeOffset ?? 0, // experiment E: saved locked range offset
    tiltGlide: settings.tiltGlide === true, // experiment E: tilt glides the pitch
    controlNames: gamepad ? GAMEPAD_GUITAR_CONTROLS : null,
  };
}

/**
 * Sound configuration of a guitar-like instrument. The bass sound is the
 * same plucked string with a darker tone and a longer decay.
 */
export function guitarSound(settings, instrument, source = resolveSource(settings, instrument)) {
  const bass = instrument === 'bass';
  const brightness = BRIGHTNESS_VALUES[settings.brightness] ?? 0.55;
  return {
    source,
    model: 'pluck',
    decay: settings.decay * (bass ? 1.5 : 1),
    brightness: bass ? brightness * 0.6 : brightness,
    program: resolveProgram(settings, instrument),
    bendRange: Math.abs(settings.bendRange ?? 2) || 2,
  };
}

/** Sound of the keyboard's piano part. */
export function keysSound(settings) {
  const source = resolveSource(settings, 'keys');
  return {
    source,
    model: source === 'pluck' ? 'pluck' : 'sustained',
    decay: settings.decay,
    brightness: BRIGHTNESS_VALUES[settings.brightness] ?? 0.55,
    program: resolveProgram(settings, 'keys'),
    bendRange: 2,
  };
}

export function drumOptions(settings, device) {
  return { map: settings.drumMap, controls: Object.keys(device.mapping.controls) };
}

/**
 * Creates the instrument for a device.
 * @returns {{ instrument: import('./instrument.js').Instrument, sounds: Record<string, object> } | null}
 */
export function createInstrument(device, instrument, settings) {
  if (isGuitarLike(instrument)) {
    const gamepad = device.detection.type !== 'guitar';
    return {
      instrument: new Guitar(guitarOptions(settings, instrument, { gamepad })),
      sounds: { main: guitarSound(settings, instrument) },
    };
  }
  if (instrument === 'drums') {
    return {
      instrument: new Drums(drumOptions(settings, device)),
      sounds: { main: { source: 'midi', model: 'oneShot', drums: true } },
    };
  }
  if (instrument === 'keys') {
    return {
      // Experiment E: the keyboard has no tilt, so no tilt glide either.
      instrument: new Keys({ guitar: { ...guitarOptions(settings, 'guitar'), tiltGlide: false } }),
      // The guitar emulation on keys 1-5 always uses the plucked string.
      sounds: { main: keysSound(settings), guitar: guitarSound(settings, 'guitar', 'pluck') },
    };
  }
  return null;
}
