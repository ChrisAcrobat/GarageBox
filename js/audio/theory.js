// Music theory helpers (design 4.2): note names, scales and MIDI note numbers.
//
// MIDI note numbers: 60 = middle C (C4), 69 = A4 (440 Hz). Note names use the
// international letters C D E F G A B with sharps (#); they are the same in
// every UI language (lang/common.json does not need them).

/** Pitch-class names, index 0 = C. */
export const NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

/**
 * Scales as semitone steps from the root. The five fret buttons play the first
 * five notes of the scale (R4.9); seven-note scales therefore play degrees 1-5.
 */
export const SCALES = Object.freeze({
  minorPentatonic: Object.freeze([0, 3, 5, 7, 10]),
  majorPentatonic: Object.freeze([0, 2, 4, 7, 9]),
  blues: Object.freeze([0, 3, 5, 6, 7, 10]),
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
});

/** "E3" for 52, "C#4" for 61. */
export function noteName(midi) {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Pitch-class name without octave, e.g. "E" for 52. */
export function pitchClassName(midi) {
  const m = Math.round(midi);
  return NOTE_NAMES[((m % 12) + 12) % 12];
}

/** Frequency in Hz of a (possibly fractional) MIDI note number. */
export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * MIDI note of the lowest fret for a root pitch class (0 = C ... 11 = B).
 * The guitar's default root E sits at E3 (52); other roots are placed at most
 * half an octave away from E3 (A#2..A3), so changing the key never makes the
 * guitar jump by almost an octave.
 */
export function guitarRootMidi(rootPitchClass) {
  let offset = (((rootPitchClass - 4) % 12) + 12) % 12;
  if (offset > 6) offset -= 12;
  return 52 + offset;
}

/**
 * MIDI notes for `count` buttons, walking up `scale` from `rootMidi`.
 * Scales with fewer notes than buttons continue in the next octave.
 */
export function scaleNotes(rootMidi, scaleName, count = 5) {
  const steps = SCALES[scaleName] || SCALES.minorPentatonic;
  const notes = [];
  for (let i = 0; i < count; i++) {
    const octave = Math.floor(i / steps.length);
    notes.push(rootMidi + steps[i % steps.length] + 12 * octave);
  }
  return notes;
}
