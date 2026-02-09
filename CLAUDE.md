# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ERNEST is a browser-based interactive emotion detection experience. A webcam feeds into facial tracking (CLMtrackr) and emotion classification, while Three.js renders the video with post-processing shader effects. An AI character named Ernest engages users in a conversational flow, analyzing their emotional responses to prompts and content (baby animal GIFs via Giphy API). The project explores the ethics of emotion detection AI.

Created by Sean Mulholland + Matt Visco.

## Running the Project

No build system, package manager, or install step. Open `index.html` directly in a modern browser with webcam access. All dependencies are vendored in `js/vendors/` and `lib/`.

## Architecture

**Static vanilla JavaScript project** — no modules, no bundler, no framework. All scripts load via `<script>` tags in `index.html` in dependency order. Everything lives in the global namespace.

### Core Modules (in `js/`)

| File | Responsibility |
|------|---------------|
| `variables.js` | Global state, DOM refs, webcam init (`createVideo()`), keyboard handlers, Giphy API calls |
| `static_intro.js` | Three.js scene setup, shader effect chain (BadTV → RGBShift → Film → Static), overlay sizing |
| `composer.js` | Main entry: `setup()` initializes everything, `draw()` is the animation loop, `askQuestion()` drives the question flow |
| `emotional_analysis.js` | CLMtrackr face tracking loop, emotion classifier invocation, 10-frame emotion smoothing |
| `typing.js` | Typewriter text effect, Y/N input handling, question sequencing with callbacks, 15s auto-timeout |
| `analytics.js` | Snapshot capture at peak emotion, analytics window display |
| `barchart.js` | D3.js bar chart rendering for emotion distribution |

### Question Flow State Machine

`currentQuestion` (0–6) drives the experience: intro → warm-up → GIF display → emotion detection prompt → prediction ("I think you felt X") → retry loop → report card → auto-reset.

### Key Architectural Patterns

- **Face distance controls shader intensity**: `faceDistance` (from facial landmarks) maps inversely to BadTV/RGBShift/Film effect strength — closer face = less distortion, triggering experience start after sustained proximity.
- **Emotion smoothing**: `meanPredict()` averages 10 frames of facial parameters before classification to reduce jitter. Six emotions tracked: happy, sad, angry, disgusted, fearful, surprised.
- **Async typing with callbacks**: `typeSentence()` recursively appends characters at 1ms intervals, then fires a callback to advance the flow.
- **UI z-index layering**: Three.js canvas (1) → face mesh overlay (3) → terminal text (5) → facebox (10) → dialog windows (15).
- **Canvas overlay alignment**: Internal 320×240 canvas for CLMtrackr is CSS-scaled to match the Three.js video plane, with `scaleX(-1)` for mirror effect.

### Vendor Libraries (in `js/vendors/` and `lib/`)

- **CLMtrackr** — Constrained Local Models facial tracking
- **Three.js** + post-processing (EffectComposer, RenderPass, ShaderPass)
- **Custom shaders** — BadTVShader.js, StaticShader.js, FilmShader, RGBShiftShader
- **D3.js** — emotion bar chart visualization
- **jQuery** — DOM manipulation
- **Pre-trained models** in `models/` — SVM/PCA facial recognition models; `emotionmodel.js` contains logistic regression coefficients for 6-emotion classification

### Key Global Variables

- `ctrack` — CLMtrackr instance
- `ec` — emotion classifier instance
- `emotions` — object accumulating detected emotion values
- `maxEmotion` — strongest emotion detected during active question
- `faceDistance`, `faceLow`, `faceHigh` — face proximity metrics
- `experienceBegin` — flag indicating user has engaged (face close enough)
- `currentQuestion` — state machine position (0–6)
- `TIMETILLRESET` — 15s inactivity timeout before auto-reset

## Development Notes

- Giphy API key is hardcoded in `variables.js`
- The project uses the modern `navigator.mediaDevices.getUserMedia` API for webcam access
- `resetAlize()` in `variables.js` handles full state reset (called on ESC or timeout)
- `?` key toggles a help/debug overlay
- All emotion models are pre-computed coefficient arrays — no training happens at runtime
