// Gamepad connect/disconnect, polling and edge detection (design 3.1).
//
// One Device per gamepad.index. Polling runs once per animation frame (the
// caller calls poll()). For every device it compares the new raw button/axis
// values with the previous frame and produces edges, both for raw inputs and
// for the logical controls from mappings.js:
//   { kind: 'button' | 'axis' | 'control', index | name, type: 'pressed' | 'released' | 'changed', value }
//
// Besides the gamepadconnected/gamepaddisconnected events, every poll also
// reconciles with navigator.getGamepads(), so devices are added or removed
// even if an event was missed (hot-plugging, R2.8, 7.1).

import { detectController } from './detect.js';
import { selectMapping, readLogical } from './mappings.js';

/** Smallest analog change reported as a 'changed' edge (filters sensor noise). */
export const ANALOG_EPSILON = 0.01;

export class Device {
  constructor(gamepad) {
    this.index = gamepad.index;
    this.id = gamepad.id;
    this.gamepadMapping = gamepad.mapping || '';
    this.detection = detectController(gamepad.id);
    this.mapping = selectMapping(this.detection.type, this.gamepadMapping);
    this.connectedAt = performance.now();
    /** Raw state of the current frame. */
    this.raw = { buttons: [], axes: [] };
    /** Logical controls of the current frame: { name: { value, pressed } }. */
    this.controls = {};
    /** Raw edges produced by the latest poll. */
    this.rawEdges = [];
    /** Logical control edges produced by the latest poll. */
    this.controlEdges = [];
    this.update(gamepad, true);
  }

  /** Copies the gamepad's current values and computes edges against the previous frame. */
  update(gamepad, initial = false) {
    const prev = this.raw;
    const buttons = Array.from(gamepad.buttons, (b) => ({ pressed: !!b.pressed, value: Number(b.value) || 0 }));
    const axes = Array.from(gamepad.axes, (a) => Number(a) || 0);
    const raw = { buttons, axes };

    const rawEdges = [];
    if (!initial) {
      buttons.forEach((b, i) => {
        const p = prev.buttons[i] || { pressed: false, value: 0 };
        if (b.pressed && !p.pressed) rawEdges.push({ kind: 'button', index: i, type: 'pressed', value: b.value });
        else if (!b.pressed && p.pressed) rawEdges.push({ kind: 'button', index: i, type: 'released', value: b.value });
        else if (Math.abs(b.value - p.value) >= ANALOG_EPSILON) rawEdges.push({ kind: 'button', index: i, type: 'changed', value: b.value });
      });
      axes.forEach((a, i) => {
        const p = prev.axes[i] ?? 0;
        if (Math.abs(a - p) >= ANALOG_EPSILON) rawEdges.push({ kind: 'axis', index: i, type: 'changed', value: a });
      });
    }

    const prevControls = this.controls;
    const controls = readLogical(this.mapping, raw);
    const controlEdges = [];
    if (!initial) {
      for (const [name, c] of Object.entries(controls)) {
        const p = prevControls[name] || { pressed: false, value: 0 };
        if (c.pressed && !p.pressed) controlEdges.push({ kind: 'control', name, type: 'pressed', value: c.value });
        else if (!c.pressed && p.pressed) controlEdges.push({ kind: 'control', name, type: 'released', value: c.value });
        else if (Math.abs(c.value - p.value) >= ANALOG_EPSILON) controlEdges.push({ kind: 'control', name, type: 'changed', value: c.value });
      }
    }

    this.raw = raw;
    this.controls = controls;
    this.rawEdges = rawEdges;
    this.controlEdges = controlEdges;
  }
}

export class GamepadManager {
  /**
   * @param {object} [options]
   * @param {() => Iterable<Gamepad|null>} [options.getGamepads] source of gamepads (replaceable for tests)
   * @param {(device: Device) => void} [options.onConnect]
   * @param {(device: Device) => void} [options.onDisconnect]
   */
  constructor({ getGamepads, onConnect, onDisconnect } = {}) {
    this.getGamepads = getGamepads || (() => (navigator.getGamepads ? navigator.getGamepads() : []));
    this.onConnect = onConnect || (() => {});
    this.onDisconnect = onDisconnect || (() => {});
    /** @type {Map<number, Device>} */
    this.devices = new Map();
    this._onConnected = (e) => this._add(e.gamepad);
    this._onDisconnected = (e) => this._remove(e.gamepad.index);
  }

  start() {
    window.addEventListener('gamepadconnected', this._onConnected);
    window.addEventListener('gamepaddisconnected', this._onDisconnected);
  }

  stop() {
    window.removeEventListener('gamepadconnected', this._onConnected);
    window.removeEventListener('gamepaddisconnected', this._onDisconnected);
  }

  /** Devices sorted by gamepad.index. */
  list() {
    return [...this.devices.values()].sort((a, b) => a.index - b.index);
  }

  _add(gamepad) {
    if (!gamepad) return null;
    const existing = this.devices.get(gamepad.index);
    if (existing && existing.id === gamepad.id) return existing;
    if (existing) this._remove(gamepad.index); // a different controller took over this slot
    const device = new Device(gamepad);
    this.devices.set(gamepad.index, device);
    this.onConnect(device);
    return device;
  }

  _remove(index) {
    const device = this.devices.get(index);
    if (!device) return;
    this.devices.delete(index);
    this.onDisconnect(device);
  }

  /** Reads all gamepads once; call once per animation frame. */
  poll() {
    let pads;
    try {
      pads = this.getGamepads() || [];
    } catch {
      // e.g. blocked by a permissions policy; treat as "no gamepads".
      pads = [];
    }
    const seen = new Set();
    for (const gp of pads) {
      if (!gp || gp.connected === false) continue;
      seen.add(gp.index);
      const device = this.devices.get(gp.index);
      if (!device || device.id !== gp.id) this._add(gp);
      else device.update(gp);
    }
    for (const index of [...this.devices.keys()]) {
      if (!seen.has(index)) this._remove(index);
    }
  }
}
