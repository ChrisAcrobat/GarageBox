// Highway view (design 6, R5.2, R5.4).
//
// A lane is drawn as a Guitar Hero-style road in perspective. A played note
// appears as a gem at the player's (near) end and travels away into the
// distance at a constant speed: the opposite direction of Guitar Hero, the
// road is a trail of what was played, not incoming targets. While the note
// rings, a sustain trail connects the gem to the near end; the trail's opacity
// follows the note's level over time (decay, fade-out, mute, volume), and
// when the note stops the trail's near end detaches and travels away too.
// The trail's width shows the whammy bend (R5.4.5). Drum hits are one-shot
// gems without a trail.
//
// HighwayState records notes per lane from the note events, with a level
// history sampled from the audio engine's VoiceTracker (design 6: envelope
// model on the main thread). Columns: the five frets on a guitar, one per pad
// on drums, and pitch on the keyboard, with one narrow column at the right
// edge for numpad drum hits (R4c.15); a keyboard in Drums mode has one column
// per drum sound, like a drums lane (R4c.13).

import { FRET_COLORS, withAlpha } from './lanes.js';
import { drawFretRow, guitarFretStates, guitarLabelStrip, pruneLaneVoices } from './simple-view.js';
import { drawKeyboard, keyboardHeight } from './keyboard-view.js';
import { noteName } from '../audio/theory.js';

/** Seconds a note needs to travel from the near end to the far end. */
export const HIGHWAY_SECONDS = 6;
/** Perspective strength: the far end is drawn 1 / (1 + K) as wide as the near end. */
const K = 2.2;
const SAMPLE_INTERVAL = 1 / 40;
/**
 * How much thinner the trail gets at full whammy when bending down (R5.4.5):
 * width = 1 - FULL_WHAMMY_THINNING x d, so 0.8 gives 20 % at full whammy.
 * Chosen by the owner after a hardware test (2026-10-24).
 */
export const FULL_WHAMMY_THINNING = 0.8;
/** How much wider the trail gets at full whammy when bending up (150 %). */
const FULL_WHAMMY_WIDENING = 0.5;
/** Pitch range spread across the keyboard lane's road. */
const KEYS_LOW = 36;
const KEYS_HIGH = 91;
/** Share of the keyboard road (Piano mode) taken by the numpad drum column at its right edge (R4c.15). */
const KEYS_DRUM_COLUMN = 0.06;

/** One trail sample: time, level and the channel's bend and bend range (R5.4.5). */
function historySample(tracker, t, level) {
  return { t, level, bend: tracker.bend || 0, range: tracker.bendRange || 0 };
}

export class HighwayState {
  constructor() {
    /** { voiceId, x (0..1 across the road), color, start, end, oneShot, velocity, midi, tracker, history: [{t, level, bend, range}] } */
    this.notes = [];
  }

  /**
   * Records a noteOn.
   * @param {object} event noteOn event
   * @param {import('../audio/audio-engine.js').VoiceTracker} tracker
   * @param {{ x: number, color: string }} place where on the road and in which color
   * @param {number} now seconds
   */
  noteOn(event, tracker, place, now) {
    this.notes.push({
      voiceId: event.voiceId,
      x: place.x,
      color: place.color,
      start: now,
      end: event.oneShot ? now : null,
      oneShot: !!event.oneShot,
      velocity: event.velocity ?? 100,
      midi: event.midi,
      tracker,
      history: [historySample(tracker, now, tracker.level(event.voiceId, now) || (event.velocity ?? 100) / 127)],
    });
  }

  /** Samples levels, ends notes whose voice has stopped, drops notes past the far end. */
  update(now) {
    for (const n of this.notes) {
      if (n.end !== null) continue;
      const alive = n.tracker.voices.has(n.voiceId);
      const level = alive ? n.tracker.level(n.voiceId, now) : 0;
      const last = n.history[n.history.length - 1];
      if (now - last.t >= SAMPLE_INTERVAL) n.history.push(historySample(n.tracker, now, level));
      if (!alive) n.end = now;
    }
    this.notes = this.notes.filter((n) => n.end === null || now - n.end < HIGHWAY_SECONDS);
  }

  clear() {
    this.notes = [];
  }
}

/** The history sample of a note at time `t` (nearest earlier sample). */
function sampleAt(note, t) {
  const h = note.history;
  let lo = 0;
  let hi = h.length - 1;
  if (t <= h[0].t) return h[0];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (h[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return h[lo];
}

/**
 * Trail width factor (R5.4.5) from how far the whammy is pressed:
 * d = |semitones| / |bendRange| (0..1, 0 when the range is 0). A negative
 * range (bending down, the default -2) thins the trail to
 * 1 - FULL_WHAMMY_THINNING x d; a positive range widens it to 1 + 0.5 x d.
 */
export function bendWidth(semitones, bendRange) {
  const range = Math.abs(bendRange || 0);
  const d = range > 0 ? Math.min(1, Math.abs(semitones || 0) / range) : 0;
  return bendRange > 0 ? 1 + FULL_WHAMMY_WIDENING * d : 1 - FULL_WHAMMY_THINNING * d;
}

/** x of a pitch on the keyboard road in Piano mode, left of the numpad column. */
function keysPitchX(midi) {
  return ((midi - KEYS_LOW) / (KEYS_HIGH - KEYS_LOW)) * (1 - KEYS_DRUM_COLUMN);
}

/**
 * Where a note goes on the road and in which color, per lane kind. On the
 * keyboard lane `columns` is the number of drum columns in Drums mode, or 0
 * in Piano mode (pitch columns plus the numpad column).
 */
export function placeNote(kind, event, laneColor, columns) {
  if (kind === 'keys' && event.part === 'drums') {
    if (columns > 0) return { x: (Math.max(0, event.column ?? 0) + 0.5) / columns, color: laneColor };
    return { x: 1 - KEYS_DRUM_COLUMN / 2, color: laneColor };
  }
  if (event.part === 'guitar' || kind === 'guitar') {
    const i = event.column ?? 0;
    if (kind === 'keys') return { x: keysPitchX(event.midi), color: FRET_COLORS[i] };
    return { x: (i + 0.5) / 5, color: FRET_COLORS[i] };
  }
  if (kind === 'keys') return { x: keysPitchX(event.midi), color: '#e8ecf4' };
  const n = Math.max(1, columns);
  return { x: ((event.column ?? 0) + 0.5) / n, color: laneColor };
}

/** Perspective projection of a road point: d = 0 near .. 1 far, x = 0..1 across. */
function makeProjection(road) {
  const sFar = 1 / (1 + K);
  return (x, d) => {
    const s = 1 / (1 + K * d);
    const y = road.yNear - (road.yNear - road.yFar) * ((1 - s) / (1 - sFar));
    return { x: road.cx + (x - 0.5) * road.w * s, y, s };
  };
}

function drawRoad(ctx, road, project, columns, color, now) {
  const nl = project(0, 0);
  const nr = project(1, 0);
  const fl = project(0, 1);
  const fr = project(1, 1);
  ctx.beginPath();
  ctx.moveTo(nl.x, nl.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, road.yNear, 0, road.yFar);
  g.addColorStop(0, 'rgba(10, 11, 14, 0.85)');
  g.addColorStop(1, 'rgba(10, 11, 14, 0.25)');
  ctx.fillStyle = g;
  ctx.fill();
  // Edges: the near end and both sides, but no line across the far end, so
  // the road looks as if it continues past the top of the lane (R5.4.4).
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = withAlpha(color, 0.55);
  ctx.stroke();

  // Column lines.
  for (let i = 1; i < columns; i++) drawColumnLine(ctx, project, i / columns);
  // Cross lines (thin, also when there are no column lines) moving away with the notes, every half second.
  ctx.lineWidth = 1;
  const step = 0.5;
  const offset = (now % step) / HIGHWAY_SECONDS;
  for (let d = offset; d < 1; d += step / HIGHWAY_SECONDS) {
    const a = project(0, d);
    const b = project(1, d);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - d)})`;
    ctx.stroke();
  }
}

/** One line along the road at x (0..1 across), like the column lines. */
function drawColumnLine(ctx, project, x) {
  const a = project(x, 0);
  const b = project(x, 1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();
}

/** One note: its sustain trail, then its gem. Head and tail are 0..1 along the road. */
function drawNote(ctx, note, project, colWidth, now) {
  const head = Math.min(1, (now - note.start) / HIGHWAY_SECONDS);
  const tail = note.end === null ? 0 : Math.min(1, (now - note.end) / HIGHWAY_SECONDS);
  if (tail >= 1) return;
  if (!note.oneShot && head > tail) drawTrail(ctx, note, project, colWidth, now, head, tail);
  // The gem at the head. Once it has reached the far end it is gone (it must
  // not pile up there while a long note still rings); the trail stays.
  if (now - note.start >= HIGHWAY_SECONDS) return;
  drawGem(ctx, note, project(note.x, head), colWidth, head);
}

/**
 * Sustain trail from the tail (near) to the head (far), in slices with the
 * opacity the note had when that part of the trail was "played" and the
 * width of the bend at that time (R5.4.5).
 */
function drawTrail(ctx, note, project, colWidth, now, head, tail) {
  const slices = Math.max(2, Math.ceil((head - tail) * 48));
  for (let i = 0; i < slices; i++) {
    const d0 = tail + ((head - tail) * i) / slices;
    const d1 = tail + ((head - tail) * (i + 1)) / slices;
    const sample = sampleAt(note, now - ((d0 + d1) / 2) * HIGHWAY_SECONDS);
    const level = sample.level;
    if (level < 0.01) continue;
    const a = project(note.x, d0);
    const b = project(note.x, d1);
    const width = colWidth * 0.32 * bendWidth(sample.bend, sample.range);
    const wa = width * a.s;
    const wb = width * b.s;
    ctx.beginPath();
    ctx.moveTo(a.x - wa / 2, a.y);
    ctx.lineTo(a.x + wa / 2, a.y);
    ctx.lineTo(b.x + wb / 2, b.y + 0.5);
    ctx.lineTo(b.x - wb / 2, b.y + 0.5);
    ctx.closePath();
    ctx.fillStyle = withAlpha(note.color, Math.min(0.9, 0.15 + level * 0.85));
    ctx.fill();
  }
}

/** The gem of a note at road point `p` (`head` 0..1 along the road). */
function drawGem(ctx, note, p, colWidth, head) {
  const size = colWidth * 0.42 * p.s * (note.oneShot ? 0.6 + 0.4 * (note.velocity / 127) : 1);
  // Fade out over the last part of the road so the gem does not just pop away.
  const fade = (1 - head * 0.6) * Math.min(1, (1 - head) / 0.15);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = note.color;
  ctx.shadowColor = note.color;
  ctx.shadowBlur = 14 * p.s;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - size * 0.08, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
  ctx.restore();
}

/** Small labels of the drum pads at the near end of the road, lit on a hit. */
function drawPadLabels(ctx, drums, project, columns, color, t, now) {
  const n = columns;
  const y = project(0, 0).y + 8;
  const w = project(1, 0).x - project(0, 0).x;
  const cw = w / n;
  ctx.font = `600 ${Math.max(9, Math.min(12, cw / 7))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  drums.pads.forEach((pad, i) => {
    const x = project((i + 0.5) / n, 0).x;
    const flash = Math.exp(-(now - pad.lastHit) / 0.18);
    ctx.beginPath();
    ctx.roundRect(x - cw / 2 + 2, y, cw - 4, 30, 5);
    ctx.fillStyle = flash > 0.02 ? withAlpha(color, 0.25 + 0.7 * flash) : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const label = t(`control.${pad.control}`);
    ctx.fillText(label, x, y + 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(t(`drum.${pad.note}`).split(' ')[0], x, y + 16);
  });
  return y + 36;
}

/** Note names of ringing notes (not yet ended) at the near end of the road. */
function drawRingingLabels(ctx, highway, project, yNear) {
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const note of highway.notes) {
    if (note.end !== null) continue;
    const p = project(note.x, 0);
    ctx.fillStyle = withAlpha(note.color, 0.9);
    ctx.fillText(noteName(note.midi), p.x, yNear - 2);
  }
}

/**
 * Draws the highway view of one lane.
 * @param {object} lane { device, color, kind, instrument, channels, highway: HighwayState }
 */
export function drawHighway(ctx, lane, area, t, now) {
  const { kind, instrument, color } = lane;
  const highway = lane.highway;
  pruneLaneVoices(lane, now); // silent voices end their notes (R5.4.2, R5.4.3)
  highway.update(now);

  // Bottom strip: what the player presses.
  let bottomH = 0;
  const fretRadius = Math.min(30, (area.w * 0.92) / 13);
  if (kind === 'guitar') bottomH = 2 * fretRadius + 44; // buttons plus their note names and orientation bars (R5.7, R5.8)
  else if (kind === 'drums') bottomH = 44;
  else if (kind === 'keys') bottomH = keyboardHeight(area.w) + 8;

  const road = {
    cx: area.x + area.w / 2,
    w: area.w * 0.92,
    yNear: area.y + area.h - bottomH - 6,
    yFar: area.y, // the road runs to the top of the lane (R5.4.4)
  };
  if (road.yNear - road.yFar < 40) return;
  const project = makeProjection(road);
  const keysDrums = kind === 'keys' && !!instrument?.drumsMode;
  let columns = 5;
  if (kind === 'drums') columns = Math.max(1, instrument?.pads.length || 1);
  else if (keysDrums) columns = Math.max(1, instrument.drumColumns().length);
  const pitchRoad = kind === 'keys' && !keysDrums;
  drawRoad(ctx, road, project, pitchRoad ? 1 : columns, color, now);
  if (pitchRoad) drawColumnLine(ctx, project, 1 - KEYS_DRUM_COLUMN);

  const colWidth = pitchRoad ? road.w / 16 : road.w / columns;
  ctx.save();
  // Oldest first, so newer gems and trails are drawn on top (R5.4.1).
  const sorted = [...highway.notes].sort((a, b) => a.start - b.start);
  for (const note of sorted) drawNote(ctx, note, project, colWidth, now);
  ctx.restore();

  if (!instrument) return;
  if (kind === 'guitar') {
    // The fret buttons sit at the near end, under their columns.
    const nearW = road.w;
    const r = fretRadius;
    const rowW = nearW - nearW / 5 + 2 * r;
    drawFretRow(ctx, guitarFretStates(instrument, lane.channels.main.tracker, now), road.cx - rowW / 2, road.yNear + 4, rowW, r, guitarLabelStrip(instrument));
  } else if (kind === 'drums') {
    drawPadLabels(ctx, instrument, project, columns, color, t, now);
  } else if (kind === 'keys') {
    drawRingingLabels(ctx, highway, project, road.yNear);
    drawKeyboard(ctx, lane.device, instrument, area.x, area.y + area.h - keyboardHeight(area.w), area.w, color, t);
  }
}
