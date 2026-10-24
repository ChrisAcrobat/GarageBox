# 54. Debug view called "Device information"

**Decision:** **The debug view is called "Device information" / "Enhetsinformation" in the UI; code and translation keys keep the `debug` name.**

**Why:** Owner's choice; the view shows information about a controller, not only fault finding.

**Alternatives:** "Detaljerad analys"; renaming the code too (churn, no user benefit).

**Where:** `settings.openDebug`, `debug.title` in `lang/en.json`, `lang/sv.json`.

Milestone: After the first hardware test

Importance: 7 – Owner already chose the UI name; the rest is internal naming.
