// Shared instrument base (design 4, 4.1).
//
// An instrument receives the logical control edges of one device each frame
// and returns note events. It owns the bookkeeping of which notes are ringing,
// but knows nothing about audio or graphics, so it can be tested on its own
// (design 9.2).
//
// Note events (design 4.1):
//   { type: 'noteOn',  voiceId, midi, velocity, time, column }
//   { type: 'noteOff', voiceId, fade, time }      fade in seconds (R4.3.1)
//   { type: 'bend',    semitones, time }          whole instrument
//   { type: 'volume',  gain, time }               whole instrument
//   { type: 'vibrato', cents, time }              whole instrument: depth of a
//                                                 ~5.5 Hz pitch LFO (0 = none),
//                                                 added on top of any bend
//   { type: 'glide',   voiceId, semitones, time } experiment E: one voice's pitch
//                                                 offset from its noteOn midi
//                                                 (per-voice detune, adds to
//                                                 the bend and vibrato)
// A noteOn may carry `glide` (semitones) so the voice starts at that offset.
// plus one non-musical event for the UI:
//   { type: 'action',  action: 'openSettings', time }
// `column` tells the visuals where the note belongs (fret index, drum pad
// index, ...). Drum hits also carry `oneShot: true` (they end by themselves).

let nextVoiceId = 1;

/** Returns a voice id that is unique across all instruments of the page. */
export function newVoiceId() {
  return nextVoiceId++;
}

export class Instrument {
  constructor() {
    /** Events produced during the current handle() call. */
    this.out = [];
  }

  /**
   * Processes one frame of input.
   * @param {Array<{name:string,type:string,value:number}>} edges logical control edges
   * @param {Record<string,{value:number,pressed:boolean}>} controls current logical state
   * @param {number} time seconds (performance.now() / 1000)
   * @returns {object[]} note events
   */
  handle(edges, controls, time) {
    this.out = [];
    this.process(edges || [], controls || {}, time);
    return this.out;
  }

  /** Subclasses implement the actual logic and call emit(). */
  process() {}

  emit(event) {
    this.out.push(event);
  }

  /** Stops every ringing note (e.g. when the instrument is replaced). */
  stopAll() {
    return [];
  }
}
