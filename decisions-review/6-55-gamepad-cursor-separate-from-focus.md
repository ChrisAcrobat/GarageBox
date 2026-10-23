# 55. Gamepad cursor separate from browser focus

**Decision:** **A gamepad "cursor" (CSS class `gamepad-focus`) per menu, separate from the browser focus; gamepad navigation never moves `document.activeElement`.**

**Why:** Several lanes can have their own panel open at once, but the page has only one focus; moving the real focus would also silence the computer-keyboard instrument (it ignores keys in form fields) and fight with mouse use.

**Alternatives:** Use real `focus()` (simpler, but one cursor for the whole page).

**Where:** `js/ui/menu-nav.js MenuNavigator`, `css/style.css`.

Milestone: Gamepad menu navigation

Importance: 6 – Enables multi-player menus; mostly invisible mechanism.
