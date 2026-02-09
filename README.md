# ERNEST

ERNEST is an interactive, browser-based emotion detection experience that uses computer vision and facial tracking to explore the ethics of AI-driven emotion recognition.

## About

ERNEST is from an era prior to ubiquitous data collection, so it needs you to help train the Happiness Model™ so it can learn what content makes people happiest.

ERNEST uses computer vision to detect your face, and then reacts to you based on your facial expressions. He's learning to understand emotions and how various pieces of content can affect your emotional expressions. But while we're training a Happiness Model™ with ERNEST, how else might this technology be applied despite the good intentions of its creators?

Through ERNEST we hope to open a dialogue around the ethics of gathering the data used to train and validate models, the places bias can creep into these models, the gap between intent and real-world applications of these models, and the tensions around augmenting or automating decision making using imperfect models.

## How It Works

ERNEST presents itself as a retro terminal-style AI character who engages you in conversation. Using your webcam, it tracks your facial expressions in real time via CLMtrackr (Constrained Local Models) and classifies six emotions — happy, sad, angry, disgusted, fearful, and surprised — using a pre-trained logistic regression model. As you interact, Three.js renders your webcam feed with post-processing shader effects (BadTV distortion, RGB shift, film grain, static) that respond to your proximity to the camera. ERNEST guides you through a series of prompts and emotional triggers, then reveals what it detected about your emotional state.

## Live Demo

https://ernest-azile.netlify.app

## Running Locally

Requires a local HTTP server (manifest and Supabase SDK need `fetch`):

```bash
# 1. Copy .env.local and fill in your Supabase credentials
#    SUPABASE_URL=https://yourproject.supabase.co
#    SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# 2. Inject credentials and start server
bash scripts/local-dev.sh

# 3. Open http://localhost:8000 and grant webcam access

# 4. When done, restore placeholders
git checkout js/variables.js
```

See `docs/PRD-happiness-model.md` for full setup including Supabase project creation, SQL schema, and Edge Function deployment.

## Tech Stack

- **Three.js** — 3D rendering with WebGL post-processing shaders
- **CLMtrackr** — real-time facial feature tracking
- **D3.js** — emotion distribution visualization
- **Supabase** — collective emotion score storage (PostgreSQL + Edge Functions)
- **Netlify** — static hosting with build-time credential injection

## Exhibitions

- **IDEO San Francisco** — Lobby installation, October & November 2018; semi-permanent installation as of July 2019
- **San Francisco Art Institute, Fort Mason Gallery** — CODAME Intersections, November 2018, part of the 50th anniversary convening of Leonardo / The International Society of Arts, Sciences and Technology
- **The Exploratorium After Dark: Artificially Intelligent** — San Francisco, CA, August 22, 2019
- **Tabačka Kulturfabrik + Kasárne Kulturpark** — Košice, Slovakia, Art+Tech Days festival, November/December 2019

## Credits

This project was primarily developed by Sean Mulholland + Matt Visco, with a bunch of support from IDEO.
