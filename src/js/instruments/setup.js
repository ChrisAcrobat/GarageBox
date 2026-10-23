// Builds an instrument and its sound configuration from a device and its
// settings (design 4, 5, 7.2). Keeps main.js free of instrument details.
//
// createInstrument() returns { instrument, sounds } where `sounds` has one
// channel configuration per part: `main` for every instrument, plus `guitar`
// for the keyboard's guitar emulation on keys 1-5 (R4c.3) and `drums` for its
// drum hits (Drums mode and numpad kit, R4c.13, R4c.14). A sound marked
// `lazy` gets its channel on first use (design 4.4).

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
  bass: 'bass',
  drums: 'midi',
  keys: 'midi',
});

/** Sound sources an instrument can use. Drums only have the MIDI drum kit. */
export const SOURCES_FOR = Object.freeze({
  guitar: ['pluck', 'midi'],
  bass: ['bass', 'pluck', 'midi'],
  drums: ['midi'],
  keys: ['midi', 'pluck'],
});

/**
 * The sounds D-pad "sound" steps through for an instrument (R4.15): the
 * generated sources, then the MIDI source with the default program (-1) and a
 * few General MIDI programs of the same family.
 */
export function soundCycle(instrument) {
  const programs = instrument === 'bass' ? [32, 34, 35, 36, 37, 38, 39] : [24, 25, 26, 28, 29, 30, 31];
  const generated = instrument === 'bass' ? ['bass', 'pluck'] : ['pluck'];
  return [
    ...generated.map((source) => ({ source })),
    { source: 'midi', program: -1 },
    ...programs.map((program) => ({ source: 'midi', program })),
  ];
}

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

/**
 * Guitar options from device settings; bass is one octave lower (R2.10) and
 * the octave setting moves both by whole octaves (R4.13).
 */
export function guitarOptions(settings, instrument, { gamepad = false, starPower = false } = {}) {
  const bass = instrument === 'bass';
  const root = guitarRootMidi(settings.root) - (bass ? 12 : 0) + 12 * (settings.octave ?? 0);
  return {
    notes: scaleNotes(root, settings.scale, 5),
    rootMidi: root,
    scale: [...(SCALES[settings.scale] || SCALES.minorPentatonic)],
    fade: settings.fadeMs / 1000,
    whammy: settings.whammy ?? 'bend',
    bendRange: settings.bendRange ?? -2,
    tiltSmoothing: (settings.tiltSmoothing ?? 80) / 1000,
    rangeOffset: settings.rangeOffset ?? 0, // saved locked range offset (R4.5.6)
    tiltGlide: settings.tiltGlide === true, // tilt glides the pitch (R4.14)
    dpadAction: settings.dpadAction ?? 'octave',
    starPower,
    controlNames: gamepad ? GAMEPAD_GUITAR_CONTROLS : null,
  };
}

/** True when the device can trigger star power: it has both a whammy and a tilt control (R5.5). */
export function canStarPower(device) {
  const controls = device?.mapping?.controls || {};
  return 'whammy' in controls && 'tilt' in controls;
}

/**
 * Sound configuration of a guitar-like instrument. A bass on the plucked
 * string gets a darker tone and a longer ring time (x1.5); the bass source
 * (R3.4.1) uses the settings as they are. The MIDI source has no ring time
 * (R4.7.1): its notes last until noteOff or the program's own envelope.
 */
export function guitarSound(settings, instrument, source = resolveSource(settings, instrument)) {
  const pluckedBass = instrument === 'bass' && source === 'pluck';
  const brightness = BRIGHTNESS_VALUES[settings.brightness] ?? 0.55;
  return {
    source,
    ...(source === 'midi' ? {} : { decay: settings.decay * (pluckedBass ? 1.5 : 1) }),
    brightness: pluckedBass ? brightness * 0.6 : brightness,
    program: resolveProgram(settings, instrument),
    bendRange: Math.abs(settings.bendRange ?? 2) || 2,
    effect: settings.effect ?? 'clean',
  };
}

/** Sound of the keyboard's piano part. */
export function keysSound(settings) {
  const source = resolveSource(settings, 'keys');
  return {
    source,
    ...(source === 'midi' ? {} : { decay: settings.decay }),
    brightness: BRIGHTNESS_VALUES[settings.brightness] ?? 0.55,
    program: resolveProgram(settings, 'keys'),
    bendRange: 2,
    effect: settings.effect ?? 'clean',
  };
}

/** The MIDI drum kit on channel 10, without an effect chain (R3.5, R3.6). */
export const DRUM_KIT_SOUND = Object.freeze({ source: 'midi', model: 'oneShot', drums: true });

/** Keys options from device settings (R4c.3, R4c.12 - R4c.14). */
export function keysOptions(settings) {
  return {
    // The keyboard has no tilt, so no tilt glide either; its D-pad action is not used.
    guitar: { ...guitarOptions(settings, 'guitar'), tiltGlide: false },
    keysMode: settings.keysMode,
    keysDrumMap: settings.keysDrumMap,
    numpadDrumMap: settings.numpadDrumMap,
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
    const starPower = canStarPower(device) && settings.starPower !== false;
    return {
      instrument: new Guitar(guitarOptions(settings, instrument, { gamepad, starPower })),
      sounds: { main: guitarSound(settings, instrument) },
    };
  }
  if (instrument === 'drums') {
    return {
      instrument: new Drums(drumOptions(settings, device)),
      sounds: { main: { ...DRUM_KIT_SOUND } },
    };
  }
  if (instrument === 'keys') {
    return {
      instrument: new Keys(keysOptions(settings)),
      // The guitar emulation on keys 1-5 always uses the plucked string; the
      // drum hits use the drum kit, created when the first hit is played.
      sounds: { main: keysSound(settings), guitar: guitarSound(settings, 'guitar', 'pluck'), drums: { ...DRUM_KIT_SOUND, lazy: true } },
    };
  }
  return null;
}
