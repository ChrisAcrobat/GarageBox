// Click outside closes a menu (R2.15, design 7.2).
//
// closeOnOutsideClick(el, onClose) registers an open menu; a primary-button
// press outside `el` calls `onClose` (the same callback as the menu's close
// button). The returned dispose() unregisters it (call it from destroy()).
//
// A press that is inside none of the open menus is swallowed: preventDefault()
// and stopPropagation() on its pointerdown and on the following mousedown,
// pointerup, mouseup and click, so whatever lies under it (e.g. the lane's ⚙
// button or the keyboard toggle) does not react. stopImmediatePropagation is
// not used, so other window capture listeners registered earlier (the audio
// unlock) still run.

const SWALLOW_MS = 1000;
const FOLLOW_UPS = ['mousedown', 'pointerup', 'mouseup', 'click'];

/** Open menus: { el, onClose }. */
const entries = [];
let installed = false;
let swallowUntil = 0; // performance.now() until which the press is swallowed; 0 = none

function swallow(event) {
  event.preventDefault();
  event.stopPropagation();
}

function onPointerDown(event) {
  swallowUntil = 0; // a new press ends any earlier swallow
  if (event.button !== 0 || event.isPrimary === false || !entries.length) return;
  const target = event.target;
  const inside = (entry) => target instanceof Node && entry.el.contains(target);
  const inMenu = entries.some(inside);
  // A copy: onClose disposes entries.
  for (const entry of entries.slice()) {
    if (!inside(entry) && entries.includes(entry)) entry.onClose();
  }
  if (inMenu) return;
  swallowUntil = performance.now() + SWALLOW_MS;
  swallow(event);
}

function onFollowUp(event) {
  if (!swallowUntil) return;
  if (performance.now() > swallowUntil) {
    swallowUntil = 0;
    return;
  }
  swallow(event);
  if (event.type === 'click') swallowUntil = 0;
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('pointerdown', onPointerDown, true);
  for (const type of FOLLOW_UPS) window.addEventListener(type, onFollowUp, true);
}

/** Closes the menu `el` with `onClose` on a click outside it. Returns dispose(). */
export function closeOnOutsideClick(el, onClose) {
  install();
  const entry = { el, onClose };
  entries.push(entry);
  return () => {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
  };
}
