# PRD: Functional Window Controls

**Project:** ERNEST
**Feature:** Make popup window title-bar buttons (Close / Maximize / Minimize) functional
**Authors:** Sean Mulholland, Matt Visco
**Status:** Complete
**Date:** 2026-02-16

---

## 1. Overview

The five popup windows (`#gif`, `#analytics`, `#reportCard`, `#dashboard`, `#about`) each have `.underscore`, `.max`, and `.x` buttons in their `.windowbar` that were previously decorative. This feature makes them functional with Windows-style behavior, plus a taskbar for minimized windows.

### Goals

- Close (X) hides the popup, with special handling for dashboard state sync and analytics timer cleanup
- Maximize toggles between default 75%x75% size and full screen-content fill
- Minimize hides the popup and adds a clickable tab to a taskbar at the bottom of the TV screen
- Taskbar tabs restore windows to their previous state (normal or maximized)
- ESC / `resetAlize()` still works — clears all maximized/minimized state

### Non-Goals

- Draggable or resizable windows
- Window stacking / z-index management
- Persist window state across resets

---

## 2. Behavior

### X (Close)
- Calls `jQuery.hide()` on the parent `.hoverWindow`
- `#dashboard`: calls `toggleDashboard()` to keep `dashboardState.visible` in sync
- `#analytics`: clears `smileTimeout` to cancel the auto-hide timer
- Removes any `.maximized` / `.minimized` class and cleans up the taskbar tab

### Max (Maximize / Restore)
- Toggles `.maximized` CSS class on the `.hoverWindow`
- Maximized: `width: 100%; height: 100%; top/left/bottom/right: 0; border-radius: 0`
- Clicking again restores to default 75%x75% dimensions

### Underscore (Minimize)
- Adds `.minimized` class (`display: none !important`) to hide the window
- Creates a `.taskbar-tab` in `#taskbar` with the window's title text
- Clicking the tab removes `.minimized`, shows the window, and removes the tab
- Taskbar is hidden when empty (`#taskbar:empty { display: none }`)

---

## 3. Files Modified

| File | Change |
|------|--------|
| `style/style.css` | Added `.maximized`, `.minimized`, `#taskbar`, `.taskbar-tab` styles; `cursor: pointer` on window buttons |
| `index.html` | Added `<div id="taskbar"></div>` inside `.screen-content` |
| `js/variables.js` | Added delegated click handlers for `.x`, `.max`, `.underscore`, `.taskbar-tab`; cleanup in `resetAlize()` |

---

## 4. Z-Index Layering

The taskbar sits at z-index 16, above popup windows (15) but below the CRT overlay (20):

1. Three.js canvas (1)
2. Face overlay (3)
3. Terminal text + bug hints (5)
4. Facebox (10)
5. Dialog windows (15)
6. **Taskbar (16)**
7. CRT overlay (20)
