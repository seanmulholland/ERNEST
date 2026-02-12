# iOS Touch Keyboard Buttons — Implementation Plan

## Feasibility Assessment

### Will this work on iOS Safari?

**Yes.** The core approach is sound:

- **Touch events**: iOS Safari fully supports `click`, `touchstart`, and `touchend` events on DOM elements. jQuery `.on('click')` already works in the codebase (see `tv-controls.js`), so touch buttons follow the exact same pattern.
- **Webcam/getUserMedia**: iOS Safari 11+ supports `navigator.mediaDevices.getUserMedia`, which the project already uses in `variables.js`. The webcam feed will work on iOS.
- **CLMtrackr**: The face tracking library runs on `<canvas>` with `requestAnimationFrame` — this is supported on iOS Safari. Performance may be lower than desktop but functional.
- **Touch detection**: `'ontouchstart' in window` or `navigator.maxTouchPoints > 0` reliably detects touch capability on iOS, allowing us to show buttons only on touch devices.

### One iOS-specific concern

- **No hover states**: Mechanical keyboard "press" effects must use `:active` pseudo-class, not `:hover`. The existing `.round-btn:active` pattern in the CSS already does this correctly.
- **Viewport meta tag**: The project is missing `<meta name="viewport">`. Without it, iOS Safari will render the page at ~980px width and scale down, making touch targets too small. We need to add this.

---

## What Needs Touch Buttons

Based on the keyboard handlers in `variables.js` and `typing.js`:

| Key | Context | Action |
|-----|---------|--------|
| **Y** | When `listeningForAnswer === true` | Confirm / accept |
| **N** | When `listeningForAnswer === true` | Deny / decline |
| **D** | When NOT `listeningForAnswer` | Toggle dashboard |
| **?** | Anytime | Toggle about/info window |
| **ESC** | Anytime | Close dashboard or reset |

The Y/N buttons are the critical path — without them, a touch user literally cannot progress through the experience. D and ? are secondary but important for full functionality.

---

## Design: Mechanical Keyboard Keys

The buttons should look like physical keycaps to match the retro CRT TV aesthetic. Key visual properties:

- **3D keycap shape**: Raised surface with beveled edges, darker sides suggesting depth
- **Legend font**: Monospace (already using `'Courier New'` and `'VT323'` in the project)
- **Color scheme**: Dark gray keycap body (`#3a3a3a`), lighter top face (`#4a4a4a`), white/green legend text
- **Press effect**: On `:active`, translate down 2-3px, flatten the box-shadow to simulate bottoming out
- **Size**: Large enough for comfortable touch targets (minimum 44x44px per Apple HIG)

### Visual Reference (CSS-only, no images needed)

```
┌─────────┐
│  ┌───┐  │  ← darker bezel/side
│  │ Y │  │  ← lighter top face with legend
│  └───┘  │
└─────────┘
```

---

## Implementation Plan

### 1. Add viewport meta tag to `index.html`

Add `<meta name="viewport" content="width=device-width, initial-scale=1">` so iOS renders at the correct scale.

### 2. Add touch button HTML to `index.html`

Insert a new `#touch-keys` container inside `.screen-content`, after the `#bug` div and before the closing `</div><!-- /.screen-content -->`. This places it in the same z-index context as the other UI elements.

```html
<!-- TOUCH KEYS (visible on touch devices only) -->
<div id="touch-keys">
    <div class="keycap" id="key-y" data-key="y">Y</div>
    <div class="keycap" id="key-n" data-key="n">N</div>
    <div class="keycap" id="key-d" data-key="d">D</div>
    <div class="keycap keycap-wide" id="key-help" data-key="?">?</div>
</div>
```

### 3. Add CSS for mechanical keycap styling to `style/style.css`

Key CSS properties:
- **Container** (`#touch-keys`): Fixed position at bottom of `.screen-content`, `display: none` by default, `display: flex` when `.touch-device` class is on body. z-index: 12 (above terminal text at 5, below modals at 15).
- **Keycap** (`.keycap`): 3D appearance via layered `box-shadow` (simulating keycap sides and shadow), `border-radius: 6px`, `background: linear-gradient(...)` for top-face lighting, `min-width/min-height: 48px` for touch targets.
- **Active state** (`.keycap:active`): `transform: translateY(3px)`, flattened box-shadow to simulate key press.
- **Visibility control**: Y/N keys shown only when `listeningForAnswer` is true (via a `.yn-active` class toggled by JS). D/? keys shown at other times.
- **Hidden on desktop**: Use `@media (hover: hover) and (pointer: fine)` to hide — this targets mouse/trackpad devices. Touch devices (including iPads with keyboards) will see the buttons.

### 4. Add touch button JavaScript

Create a new file `js/touch-keys.js` (loaded after `typing.js` and before `composer.js`):

- **Touch detection**: On DOMContentLoaded, check `'ontouchstart' in window || navigator.maxTouchPoints > 0`. If true, add `.touch-device` class to `<body>`.
- **Click handlers**: Each `.keycap` click synthesizes the equivalent keyboard event by calling the same functions the keyboard handlers call:
  - `#key-y`: If `listeningForAnswer`, execute the same Y-key logic from `typing.js:17-28`
  - `#key-n`: If `listeningForAnswer`, execute the same N-key logic from `typing.js:29-45`
  - `#key-d`: If `!listeningForAnswer`, call `toggleDashboard()`
  - `#key-help`: Call `$('#about').toggle()`
- **Visibility sync**: Hook into `yesOrNo()` to add `.yn-active` class (show Y/N keys), and into `moveToNextStep()` to remove it (hide Y/N keys).
- **Prevent double-tap zoom**: Add `touch-action: manipulation` CSS on `.keycap` elements.

### 5. Refactor Y/N logic for reuse

Currently the Y/N key logic lives inline in the `keypress` handler in `typing.js:15-49`. Extract the Y and N actions into standalone functions (`handleYes()` and `handleNo()`) that both the keyboard handler and touch buttons can call. This avoids duplicating the question flow logic.

### 6. Script loading order in `index.html`

Add `<script src="js/touch-keys.js"></script>` after `tv-controls.js` and before `composer.js`:

```html
<script src="js/tv-controls.js"></script>
<script src="js/touch-keys.js"></script>
<script src="js/composer.js"></script>
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `index.html` | Add viewport meta tag, touch-keys HTML, script tag |
| `style/style.css` | Add `#touch-keys` and `.keycap` styles, media query for desktop hiding |
| `js/touch-keys.js` | **New file** — touch detection, click handlers, visibility sync |
| `js/typing.js` | Extract `handleYes()` / `handleNo()` from keypress handler |

---

## What This Does NOT Change

- Desktop keyboard behavior — unchanged
- Question flow state machine — unchanged (touch buttons call the same functions)
- Face tracking or shader effects — unchanged
- Any vendor/library code — unchanged
