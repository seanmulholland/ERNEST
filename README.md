# ERNEST

ERNEST is an interactive, browser-based emotion detection experience that uses computer vision and facial tracking to explore the ethics of AI-driven emotion recognition.

## About

ERNEST is from an era prior to ubiquitous data collection, so it needs you to help train the Happiness Model™ so it can learn what content makes people happiest.

ERNEST uses computer vision to detect your face, and then reacts to you based on your facial expressions. He's learning to understand emotions and how various pieces of content can affect your emotional expressions. But while we're training a Happiness Model™ with ERNEST, how else might this technology be applied despite the good intentions of its creators?

Through ERNEST we hope to open a dialogue around the ethics of gathering the data used to train and validate models, the places bias can creep into these models, the gap between intent and real-world applications of these models, and the tensions around augmenting or automating decision making using imperfect models.

## How It Works

ERNEST presents itself as a retro terminal-style AI character who engages you in conversation. Using your webcam, it tracks your facial expressions in real time via CLMtrackr (Constrained Local Models) and classifies six emotions — happy, sad, angry, disgusted, fearful, and surprised — using a pre-trained logistic regression model. As you interact, Three.js renders your webcam feed with post-processing shader effects (BadTV distortion, RGB shift, film grain, static) that respond to your proximity to the camera. ERNEST guides you through a series of prompts and emotional triggers, then reveals what it detected about your emotional state.

## Running

Open `index.html` in a modern browser and grant webcam access. No build tools, install steps, or server required — all dependencies are vendored.

## Tech Stack

- **Three.js** — 3D rendering with WebGL post-processing shaders
- **CLMtrackr** — real-time facial feature tracking
- **D3.js** — emotion distribution visualization
- **Giphy API** — emotional trigger content

## Exhibitions

- **IDEO San Francisco** — Lobby installation, October & November 2018; semi-permanent installation as of July 2019
- **San Francisco Art Institute, Fort Mason Gallery** — CODAME Intersections, November 2018, part of the 50th anniversary convening of Leonardo / The International Society of Arts, Sciences and Technology
- **The Exploratorium After Dark: Artificially Intelligent** — San Francisco, CA, August 22, 2019
- **Tabačka Kulturfabrik + Kasárne Kulturpark** — Košice, Slovakia, Art+Tech Days festival, November/December 2019

## Credits

This project was primarily developed by Sean Mulholland + Matt Visco, with a bunch of support from IDEO.
