# Keyboard guitar keys: no tilt, no glide, stored offset only

Importance: 7 – rarely noticed.

**Decision:** design 4.4: the computer keyboard's internal guitar never toggles tilt (no Back), always has `tiltGlide: false`, and plays at the keyboard's stored `rangeOffset` (normally 0, nothing changes it). Its note strip still uses the same strip drawing (no slide, since it never tilts).

**Rationale:** matches experiment E (`tiltGlide: false` forced in setup).

**Alternatives:** a key to toggle a virtual tilt.

**Where:** design 4.4, 7.2.
