// Debug view (design 9.1): raw input of one device, covering exactly that
// device's lane so other lanes keep working. Shows gamepad.id, the detected
// type, the parsed VID:PID, the mapping, the live value of every raw button
// and axis with the logical controls they feed, the logical controls, and a
// short log of recent raw edges. Used to confirm the Xplorer's indexes.
//
// "Copy report" exports a plain-text report (device info, current values and
// every raw change since the view opened or "Clear log" was pressed) so it can
// be pasted into a chat or an issue. The report is a technical artifact and is
// always written in English, independent of the UI language, so whoever reads
// it sees the same format; the buttons and messages around it are translated.
//
// When opened from a gamepad menu, the view's buttons can be driven by the
// lane's controller (design 7.4): D-pad up/down moves the gamepad cursor,
// right presses, Back closes.

import { t } from '../i18n/i18n.js';
import { formatVidPid } from '../input/detect.js';
import { controlsForAxis, controlsForButton, describeSource } from '../input/mappings.js';
import { MenuNavigator } from './menu-nav.js';

const LOG_LENGTH = 12;

/** Maximum number of input changes kept for the exported report. */
export const EXPORT_LOG_LIMIT = 500;
/** Axis changes smaller than this (since the last logged value) are not logged. */
export const AXIS_DEADBAND = 0.05;
/** Same for the analog value of buttons (e.g. triggers); press/release is always logged. */
export const BUTTON_DEADBAND = 0.05;
/** An axis within this distance of a rest value counts as "at rest". */
const REST_EPSILON = 0.02;
const COPIED_MESSAGE_MS = 2000;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Sets textContent only when it changed, to keep per-frame updates cheap. */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Records every raw change of one device for the exported report.
 * Axis changes below AXIS_DEADBAND are ignored, except that returning to rest
 * (0, -1, or the value the axis had when recording started) is always logged.
 */
export class InputRecorder {
  constructor(device) {
    this.device = device;
    this.clear();
  }

  /** Starts a new recording from the device's current state. */
  clear() {
    this.startTime = performance.now();
    this.startDate = new Date();
    this.entries = [];
    this.dropped = 0;
    const { buttons, axes } = this.device.raw;
    this.buttons = buttons.map((b) => ({ ...b }));
    this.axes = [...axes];
    this.restValues = axes.map((v) => [0, -1, v]);
  }

  _atRest(index, value) {
    const rest = this.restValues[index] || [0, -1];
    return rest.some((r) => Math.abs(value - r) <= REST_EPSILON);
  }

  _push(entry) {
    this.entries.push(entry);
    if (this.entries.length > EXPORT_LOG_LIMIT) {
      this.entries.shift();
      this.dropped++;
    }
  }

  /** Compares the device's current raw state with the last logged values; call once per frame. */
  record() {
    const time = performance.now() - this.startTime;
    const { buttons, axes } = this.device.raw;
    buttons.forEach((b, i) => {
      const prev = this.buttons[i] || { pressed: false, value: 0 };
      const pressChanged = b.pressed !== prev.pressed;
      const valueChanged =
        Math.abs(b.value - prev.value) >= BUTTON_DEADBAND ||
        (b.value !== prev.value && (b.value === 0 || b.value === 1));
      if (pressChanged || valueChanged) {
        this._push({ time, kind: 'button', index: i, from: prev, to: { ...b } });
        this.buttons[i] = { ...b };
      }
    });
    axes.forEach((v, i) => {
      if (!this.restValues[i]) this.restValues[i] = [0, -1, v];
      const prev = this.axes[i] ?? v;
      const backToRest = this._atRest(i, v) && !this._atRest(i, prev);
      const log = Math.abs(v - prev) >= AXIS_DEADBAND || backToRest;
      if (log) this._push({ time, kind: 'axis', index: i, from: prev, to: v });
      // Small drifts accumulate against the last logged value until they pass the deadband.
      if (log || this.axes[i] === undefined) this.axes[i] = v;
    });
  }
}

/** "2026-10-21 23:40:12 UTC+02:00" in the browser's local time zone. */
function formatLocalTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} ` +
    `UTC${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

const fmtButton = (v) => v.toFixed(2);
const fmtAxis = (v) => (v < 0 ? '' : '+') + v.toFixed(3);

/**
 * Builds the plain-text debug report for one device.
 * @param {import('../input/gamepad-manager.js').Device} device
 * @param {InputRecorder} recorder
 * @param {Date} [now]
 */
export function buildReport(device, recorder, now = new Date()) {
  const d = device.detection;
  const { buttons, axes } = device.raw;
  const lines = [];
  const kv = (key, value) => lines.push(`${(key + ':').padEnd(17)}${value}`);
  const mapsTo = (names) => (names.length ? names.join(', ') : '-');

  lines.push('GarageBox - Music Sandbox - controller debug report');
  kv('Time', formatLocalTime(now));
  kv('User agent', navigator.userAgent);
  kv('gamepad.id', device.id);
  kv('Index', `${device.index} (controller ${device.index + 1})`);
  kv('Browser mapping', device.gamepadMapping || '(none)');
  kv('Detected type', `${d.type} (rule: ${d.source})`);
  kv('VID:PID', (formatVidPid(d.vidPid) || '(none)') + (d.knownName ? ` (known: ${d.knownName})` : ''));
  if (d.xinput) kv('XInput subtype', d.xinput);
  kv('App mapping', device.mapping.name);
  kv('Buttons / axes', `${buttons.length} / ${axes.length}`);

  lines.push('', 'Buttons (current):');
  lines.push('  idx  state  value  maps to');
  buttons.forEach((b, i) => {
    lines.push(`  ${`B${i}`.padEnd(4)} ${(b.pressed ? 'down' : 'up').padEnd(6)} ${fmtButton(b.value).padStart(5)}  ${mapsTo(controlsForButton(device.mapping, i))}`);
  });

  lines.push('', 'Axes (current):');
  lines.push('  idx    value  maps to');
  axes.forEach((v, i) => {
    lines.push(`  ${`A${i}`.padEnd(4)} ${fmtAxis(v).padStart(7)}  ${mapsTo(controlsForAxis(device.mapping, i))}`);
  });

  lines.push('', 'Logical controls (current, 0.00-1.00):');
  for (const [name, source] of Object.entries(device.mapping.controls)) {
    const c = device.controls[name] || { value: 0, pressed: false };
    lines.push(`  ${name.padEnd(10)} ${describeSource(source).padEnd(4)} ${c.value.toFixed(2)} ${c.pressed ? 'on' : 'off'}`);
  }

  lines.push('');
  lines.push(
    `Input log since ${formatLocalTime(recorder.startDate)}: ${recorder.entries.length} changes` +
      (recorder.dropped ? ` (${recorder.dropped} older changes dropped, limit ${EXPORT_LOG_LIMIT})` : '') +
      `, axis deadband ${AXIS_DEADBAND}`,
  );
  if (!recorder.entries.length) {
    lines.push('  (no changes)');
  } else {
    lines.push(`       ms  input        ${'old -> new'.padEnd(22)}  maps to`);
    for (const e of recorder.entries) {
      let input;
      let change;
      let controls;
      if (e.kind === 'button') {
        input = `button ${e.index}`;
        const state = e.to.pressed !== e.from.pressed ? (e.to.pressed ? ' pressed' : ' released') : '';
        change = `${fmtButton(e.from.value)} -> ${fmtButton(e.to.value)}${state}`;
        controls = controlsForButton(device.mapping, e.index);
      } else {
        input = `axis ${e.index}`;
        change = `${fmtAxis(e.from)} -> ${fmtAxis(e.to)}`;
        controls = controlsForAxis(device.mapping, e.index);
      }
      lines.push(`  ${String(Math.round(e.time)).padStart(7)}  ${input.padEnd(11)}  ${change.padEnd(22)}  ${mapsTo(controls)}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** Copies text with the legacy execCommand API. Returns true on success. */
function copyWithExecCommand(text, host) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  host.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export class DebugView {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container lane overlay element
   * @param {import('../input/gamepad-manager.js').Device} options.device
   * @param {() => void} options.onClose
   * @param {boolean} [options.focus] move the browser focus to the close button (default true)
   * @param {boolean} [options.gamepadMenu] opened from a gamepad menu: gamepad cursor and navigate() are active
   */
  constructor({ container, device, onClose, focus = true, gamepadMenu = false }) {
    this.device = device;
    this.log = [];
    this.recorder = new InputRecorder(device);
    this.onClose = onClose;
    this.gamepadMenu = !!gamepadMenu;
    this.el = el('section', 'debug-view');
    this.el.setAttribute('role', 'dialog');
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });

    const header = el('header', 'panel-header');
    this.titleEl = el('h2', 'panel-title');
    this.closeButton = el('button', 'icon-button close-button', '×');
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', onClose);
    header.append(this.titleEl, this.closeButton);

    // Toolbar: export and clear (for the hardware check, design 9.1).
    const toolbar = el('div', 'debug-toolbar');
    this.copyButton = el('button', 'button copy-report-button');
    this.copyButton.type = 'button';
    this.copyButton.addEventListener('click', () => this.copyReport());
    this.clearButton = el('button', 'button clear-log-button');
    this.clearButton.type = 'button';
    this.clearButton.addEventListener('click', () => this.clearLog());
    this.statusEl = el('span', 'debug-status');
    this.statusEl.setAttribute('aria-live', 'polite');
    this.countEl = el('span', 'debug-count');
    toolbar.append(this.copyButton, this.clearButton, this.statusEl, this.countEl);

    // Shown only when copying to the clipboard failed: copy by hand.
    this.manualEl = el('div', 'debug-manual');
    this.manualEl.hidden = true;
    this.manualText = el('p', 'debug-manual-text');
    this.manualArea = el('textarea', 'debug-manual-area');
    this.manualArea.readOnly = true;
    this.manualArea.spellcheck = false;
    this.manualClose = el('button', 'button debug-manual-close');
    this.manualClose.type = 'button';
    this.manualClose.addEventListener('click', () => {
      this.manualEl.hidden = true;
      this.nav?.sync();
    });
    this.manualEl.append(this.manualText, this.manualArea, this.manualClose);

    this.hintEl = el('p', 'gamepad-hint');

    this.body = el('div', 'debug-body');
    this.el.append(header, toolbar, this.hintEl, this.manualEl, this.body);
    this.nav = null;
    this.refresh();
    container.appendChild(this.el);
    if (this.gamepadMenu) this.nav = new MenuNavigator(this.el, { initial: '.close-button' });
    if (focus) this.closeButton.focus({ preventScroll: true });
  }

  /** Handles one menu intent of this lane's controller (design 7.4); Back closes. */
  navigate(intent) {
    if (!this.gamepadMenu) return;
    if (intent === 'back') {
      this.onClose();
      return;
    }
    this.nav?.navigate(intent);
  }

  /** Rebuilds the whole view (after a language change or a change in input counts). */
  refresh() {
    const { device } = this;
    const d = device.detection;
    this.titleEl.textContent = t('debug.title', { number: device.index + 1 });
    this.closeButton.title = t('common.close');
    this.closeButton.setAttribute('aria-label', t('common.close'));
    this.copyButton.textContent = t('debug.copyReport');
    this.clearButton.textContent = t('debug.clearLog');
    this.manualText.textContent = t('debug.copyManual');
    this.manualClose.textContent = t('common.close');
    this.hintEl.textContent = t('debug.gamepadHint');
    this.hintEl.hidden = !this.gamepadMenu;
    this.lastCount = -1;

    const info = el('dl', 'debug-info');
    const addInfo = (labelKey, value) => {
      info.append(el('dt', '', t(labelKey)), el('dd', '', value));
    };
    addInfo('debug.id', device.id);
    addInfo('debug.index', String(device.index));
    addInfo('debug.detectedType', `${t(`type.${d.type}`)} (${t(`detect.source.${d.source}`)})`);
    addInfo('debug.vidPid', formatVidPid(d.vidPid) || t('debug.none'));
    if (d.knownName) addInfo('debug.knownName', d.knownName);
    if (d.xinput) addInfo('debug.xinput', d.xinput);
    addInfo('debug.browserMapping', device.gamepadMapping || t('debug.none'));
    addInfo('debug.mapping', device.mapping.name);

    // Raw buttons
    this.buttonRows = [];
    const buttons = el('table', 'debug-table');
    buttons.append(this._headRow(['debug.col.button', 'debug.col.pressed', 'debug.col.value', 'debug.col.control']));
    device.raw.buttons.forEach((_, i) => {
      const row = el('tr');
      const cells = [el('td', 'num', `B${i}`), el('td', 'flag'), el('td', 'num'), el('td', 'ctl')];
      cells[3].textContent = controlsForButton(device.mapping, i).join(', ');
      row.append(...cells);
      buttons.append(row);
      this.buttonRows.push({ row, pressed: cells[1], value: cells[2] });
    });

    // Raw axes
    this.axisRows = [];
    const axes = el('table', 'debug-table');
    axes.append(this._headRow(['debug.col.axis', 'debug.col.value', '', 'debug.col.control']));
    device.raw.axes.forEach((_, i) => {
      const row = el('tr');
      const bar = el('div', 'axis-bar');
      const fill = el('div', 'axis-fill');
      bar.append(fill);
      const barCell = el('td', 'bar');
      barCell.append(bar);
      const cells = [el('td', 'num', `A${i}`), el('td', 'num'), barCell, el('td', 'ctl')];
      cells[3].textContent = controlsForAxis(device.mapping, i).join(', ');
      row.append(...cells);
      axes.append(row);
      this.axisRows.push({ value: cells[1], fill });
    });

    // Logical controls
    this.controlRows = [];
    const controls = el('table', 'debug-table');
    controls.append(this._headRow(['debug.col.control', 'debug.col.source', 'debug.col.value', 'debug.col.pressed']));
    for (const [name, source] of Object.entries(device.mapping.controls)) {
      const row = el('tr');
      const cells = [el('td', 'ctl', name), el('td', 'num', describeSource(source)), el('td', 'num'), el('td', 'flag')];
      row.append(...cells);
      controls.append(row);
      this.controlRows.push({ name, row, value: cells[2], pressed: cells[3] });
    }

    this.logEl = el('ol', 'debug-log');

    const section = (titleKey, content) => {
      const s = el('section', 'debug-section');
      s.append(el('h3', '', t(titleKey)), content);
      return s;
    };
    this.body.replaceChildren(
      section('debug.section.device', info),
      section('debug.section.buttons', buttons),
      section('debug.section.axes', axes),
      section('debug.section.controls', controls),
      section('debug.section.log', this.logEl),
    );
    this.buttonCount = device.raw.buttons.length;
    this.axisCount = device.raw.axes.length;
    this._renderLog();
    this.update();
  }

  _headRow(keys) {
    const row = el('tr');
    for (const key of keys) row.append(el('th', '', key ? t(key) : ''));
    return row;
  }

  /** Updates live values; call once per frame after polling. */
  update() {
    const { device } = this;
    this.recorder.record();
    const count = this.recorder.entries.length + this.recorder.dropped;
    if (count !== this.lastCount) {
      this.lastCount = count;
      setText(this.countEl, t('debug.logCount', { count }));
    }
    if (device.raw.buttons.length !== this.buttonCount || device.raw.axes.length !== this.axisCount) {
      this.refresh();
      return;
    }
    device.raw.buttons.forEach((b, i) => {
      const r = this.buttonRows[i];
      setText(r.pressed, b.pressed ? '●' : '·');
      setText(r.value, b.value.toFixed(2));
      r.row.classList.toggle('active', b.pressed);
    });
    device.raw.axes.forEach((a, i) => {
      const r = this.axisRows[i];
      setText(r.value, a.toFixed(3));
      const v = Math.max(-1, Math.min(1, a));
      r.fill.style.left = `${50 + Math.min(0, v) * 50}%`;
      r.fill.style.width = `${Math.abs(v) * 50}%`;
    });
    for (const r of this.controlRows) {
      const c = device.controls[r.name];
      setText(r.value, c.value.toFixed(2));
      setText(r.pressed, c.pressed ? '●' : '·');
      r.row.classList.toggle('active', c.pressed);
    }
    if (device.rawEdges.length) {
      for (const e of device.rawEdges) {
        // Consecutive moves of the same axis update one log line instead of
        // pushing out the useful lines.
        if (e.kind === 'axis' && this._coalesceAxis(e)) continue;
        this.log.unshift(e);
      }
      this.log.length = Math.min(this.log.length, LOG_LENGTH);
      this._renderLog();
    }
  }

  _coalesceAxis(edge) {
    const last = this.log[0];
    if (last && last.kind === 'axis' && last.index === edge.index) {
      last.value = edge.value;
      return true;
    }
    return false;
  }

  _renderLog() {
    if (!this.log.length) {
      this.logEl.replaceChildren(el('li', 'muted', t('debug.logEmpty')));
      return;
    }
    this.logEl.replaceChildren(
      ...this.log.map((e) => {
        const name = e.kind === 'button' ? `B${e.index}` : `A${e.index}`;
        return el('li', '', `${name} ${t(`debug.edge.${e.type}`)} ${e.value.toFixed(3)}`);
      }),
    );
  }

  /** Plain-text report of this device (see buildReport). */
  buildReport() {
    return buildReport(this.device, this.recorder);
  }

  /** Starts a new input log (export and on-screen). */
  clearLog() {
    this.recorder.clear();
    this.log = [];
    this._renderLog();
    this.manualEl.hidden = true;
    this._showStatus(t('debug.logCleared'));
  }

  /**
   * Copies the report: Clipboard API first (secure contexts), then the legacy
   * execCommand fallback, and if both fail shows it in a read-only text area.
   * Resolves to 'clipboard', 'execCommand' or 'manual'.
   */
  async copyReport() {
    const text = this.buildReport();
    let method = null;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        method = 'clipboard';
      } catch (err) {
        console.warn('Clipboard API copy failed, trying fallback', err);
      }
    }
    if (!method && copyWithExecCommand(text, this.el)) method = 'execCommand';
    if (method) {
      this.manualEl.hidden = true;
      this._showStatus(t('debug.copied'));
      return method;
    }
    this.manualArea.value = text;
    this.manualEl.hidden = false;
    this.nav?.sync();
    this.manualArea.focus({ preventScroll: true });
    this.manualArea.select();
    this._showStatus(t('debug.copyFailed'));
    return 'manual';
  }

  _showStatus(text) {
    this.statusEl.textContent = text;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this.statusEl.textContent = '';
    }, COPIED_MESSAGE_MS);
  }

  destroy() {
    clearTimeout(this._statusTimer);
    this.el.remove();
  }
}
