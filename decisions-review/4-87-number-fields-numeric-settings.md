# 87. Number fields for numeric settings (R2.9.1)

- **Decision:** Owner wants numeric settings as number fields instead of drop-down lists, with higher values possible (supersedes reviewed decision 10's fixed lists). My limits: fade 10–10000 ms step 50; ring time 0.5–30 s step 0.5 (guitar 4 s, bass 6 s); tilt smoothing 0–1000 ms step 10 (default 80); bend range −24…+24 step 1 (default −2). Out-of-range typed values are clamped; invalid entry restores the previous value. Named choices stay drop-downs.
- **Rationale:** Free values for tuning by ear; steps chosen so the controller can reach useful values quickly with key repeat.
- **Alternatives:** Longer drop-down lists; sliders.
- **Where:** R2.9.1, R4.3.1, design 4.2, 5, 7.2, 7.4.

Milestone: none (newer entry in `## nn. Title` format, added after the milestone sections)

Status: already decided by owner 2026-10-22, written into docs.

The mute fade-out default is no longer part of this decision: the owner chose 500 ms on 2026-10-24 after the hardware test (R4.3.1). Still open for review: the limits and steps above.

Importance: 4 – Affects every numeric setting.
