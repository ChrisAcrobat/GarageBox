// Known guitar and drum kit controllers by USB vendor and product ID (R2.5).
//
// Source: the xpad_device[] table of the Linux kernel Xbox gamepad driver,
// drivers/input/joystick/xpad.c
// https://github.com/torvalds/linux/blob/master/drivers/input/joystick/xpad.c
// (fetched 2026-10-21; latest commit touching the file at that time:
// 41363c27b8509bd4efcba244803edac9ba25d1b5).
//
// Only entries whose names clearly identify a guitar or a drum kit are listed.
// Dance pads, fight sticks and regular pads from the same vendors are left out
// on purpose. The names are the ones used in xpad.c.
//
// vid/pid are lowercase, zero-padded 4-digit hex strings.

export const KNOWN_DEVICES = Object.freeze([
  // Guitars
  { vid: '1430', pid: '4748', type: 'guitar', name: 'RedOctane Guitar Hero X-plorer' },
  { vid: '1bad', pid: '0002', type: 'guitar', name: 'Harmonix Rock Band Guitar' },

  // Drum kits
  { vid: '0738', pid: '9871', type: 'drumKit', name: 'Mad Catz Portable Drum' },
  { vid: '0f0d', pid: '01b2', type: 'drumKit', name: 'HORI Taiko No Tatsujin Drum Controller' },
  { vid: '1bad', pid: '0003', type: 'drumKit', name: 'Harmonix Rock Band Drumkit' },
  { vid: '1bad', pid: '0130', type: 'drumKit', name: 'Ion Drum Rocker' },
]);

/** Returns the known-device entry for a vendor/product pair, or null. */
export function findKnownDevice(vid, pid) {
  const v = String(vid).toLowerCase();
  const p = String(pid).toLowerCase();
  return KNOWN_DEVICES.find((d) => d.vid === v && d.pid === p) || null;
}
