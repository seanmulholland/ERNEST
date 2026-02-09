# PRD: Happiness Model

**Project:** ERNEST
**Feature:** Collective Happiness Model — persistent emotion scoring and content ranking
**Authors:** Sean Mulholland, Matt Visco
**Status:** Draft
**Date:** 2026-02-08

---

## 1. Overview

ERNEST currently shows users a random baby animal GIF from the Giphy API, detects their emotional reaction via webcam, and displays per-session scores that are discarded on reset. The Happiness Model evolves this into a collective system: a curated content library replaces the random API call, emotion scores from every visitor are stored persistently, and a dashboard lets users explore how content ranks across all visitors.

### Goals

- Replace ephemeral Giphy API calls with a static, curated content repository
- Persist emotion scores from every session to build collective rankings
- Surface collective sentiment in the existing report card flow
- Provide a dashboard for exploring content rankings by emotion
- Maintain the project's zero-build, vanilla JS, static-hosting architecture

### Non-Goals

- Per-user accounts or authentication
- Content upload by visitors
- Real-time multiplayer / live reaction feeds
- Mobile-specific UI optimization
- Training or modifying the emotion detection model

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Hosting** | Netlify | Existing account, auto-deploy from GitHub, custom domain support, free tier sufficient |
| **Score storage** | Supabase | Free tier PostgreSQL, JS client available via CDN `<script>` tag (no build step), Row Level Security for public writes |
| **Content source** | Static files in `content/` directory | Eliminates API dependency, enables curation, content versioned in repo |
| **Content manifest** | Generated `content-manifest.json` | Decouples file system from runtime; simple JSON the app reads at startup |
| **Scope** | Collective (all visitors) | Scores are anonymous and aggregated — no per-user tracking |

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│  Browser (ERNEST)                                   │
│                                                     │
│  index.html                                         │
│    ├── loads content-manifest.json (fetch)           │
│    ├── displays content from content/                │
│    ├── detects emotions (CLMtrackr + classifier)     │
│    ├── writes scores → Supabase JS SDK              │
│    ├── reads aggregate rankings ← Supabase JS SDK   │
│    └── renders dashboard overlay ([D] key)           │
│                                                     │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
     ┌──────────────┐    ┌──────────────────┐
     │  Netlify CDN  │    │  Supabase        │
     │               │    │                  │
     │  Static files │    │  PostgreSQL DB   │
     │  content/     │    │  - reactions     │
     │  manifest.json│    │  - aggregates    │
     └──────────────┘    └──────────────────┘
```

---

## 3. Feature 1: Content Repository System

### 3.1 Content Directory

A new `content/` directory at the project root holds curated images and GIFs. These are static assets served by Netlify alongside the rest of the site.

```
content/
  ├── baby-otter-01.gif
  ├── baby-panda-02.gif
  ├── baby-raccoon-03.jpg
  ├── kitten-04.gif
  └── ...
```

**Constraints:**
- Supported formats: `.gif`, `.jpg`, `.jpeg`, `.png`, `.webp`
- Recommended max file size: 5 MB per file (Netlify free tier has 100 GB bandwidth/month)
- Minimum content library: 10 items to provide variety before repeat

### 3.2 Content Manifest

A `content-manifest.json` file at the project root describes every piece of content. The app loads this file on startup instead of calling the Giphy API.

**Schema:**

```json
{
  "version": 1,
  "generated": "2026-02-08T12:00:00Z",
  "items": [
    {
      "id": "baby-otter-01",
      "filename": "baby-otter-01.gif",
      "type": "gif",
      "added": "2026-02-08",
      "tags": ["otter", "baby", "cute"]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, derived from filename (without extension) |
| `filename` | string | File name within `content/` directory |
| `type` | string | `"gif"`, `"image"` — determined by file extension |
| `added` | string | ISO 8601 date when file was added to repository |
| `tags` | string[] | Optional descriptive tags for future filtering |

### 3.3 Manifest Generator Script

A Node.js script (`scripts/generate-manifest.js`) scans the `content/` directory and produces `content-manifest.json`. This runs manually whenever content is added or removed.

**Behavior:**
- Scans `content/` for supported image/GIF file extensions
- Generates `id` from filename (strips extension, lowercases)
- Sets `type` to `"gif"` for `.gif` files, `"image"` for all others
- Sets `added` to current date for new entries; preserves existing dates for unchanged files (reads previous manifest if present)
- Writes output to `content-manifest.json` in project root
- Prints summary: added, removed, total counts

**Usage:**
```bash
node scripts/generate-manifest.js
```

### 3.4 Content Selection in App

Replace the `gifSrc()` function in `variables.js` with manifest-driven content selection.

**Current flow:**
1. `gifSrc()` calls Giphy API → gets random baby animal GIF URL
2. Sets `.gifSrc` elements' `src` to that URL

**New flow:**
1. On page load, fetch `content-manifest.json` and store as global `contentManifest`
2. New function `selectContent()` picks a random item from `contentManifest.items` that hasn't been shown in the current session (track shown IDs in a `sessionShownContent` array)
3. Sets `.gifSrc` elements' `src` to `content/<filename>`
4. Stores the selected item's `id` as `currentContentId` (global) for score submission
5. When all items have been shown, reset the tracking array and re-shuffle

**Fallback:** If manifest fetch fails, fall back to the existing Giphy API call (preserve `gifSrc()` as `gifSrcFallback()`).

---

## 4. Feature 2: Score Storage (Supabase)

### 4.1 Supabase Setup

**Client loading:** Add the Supabase JS SDK via CDN `<script>` tag in `index.html`, loaded before application scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

**Initialization:** In `variables.js`, initialize the Supabase client:

```javascript
var SUPABASE_URL = 'https://<project-ref>.supabase.co';
var SUPABASE_ANON_KEY = '<anon-key>';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

> **Note:** The anon key is safe to expose in client-side code. Row Level Security (RLS) policies control what operations are allowed.

### 4.2 Database Schema

**Table: `reactions`**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | Auto-generated row ID |
| `content_id` | text | NOT NULL | References content manifest `id` |
| `session_id` | text | NOT NULL | Browser-generated session UUID |
| `happy` | real | NOT NULL, default 0 | Happy score (0.0–1.0) |
| `sad` | real | NOT NULL, default 0 | Sad score (0.0–1.0) |
| `angry` | real | NOT NULL, default 0 | Angry score (0.0–1.0) |
| `disgusted` | real | NOT NULL, default 0 | Disgusted score (0.0–1.0) |
| `fearful` | real | NOT NULL, default 0 | Fearful score (0.0–1.0) |
| `surprised` | real | NOT NULL, default 0 | Surprised score (0.0–1.0) |
| `dominant_emotion` | text | NOT NULL | The max emotion for this reaction |
| `created_at` | timestamptz | default `now()` | When the reaction was recorded |

**SQL to create:**

```sql
CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  session_id text NOT NULL,
  happy real NOT NULL DEFAULT 0,
  sad real NOT NULL DEFAULT 0,
  angry real NOT NULL DEFAULT 0,
  disgusted real NOT NULL DEFAULT 0,
  fearful real NOT NULL DEFAULT 0,
  surprised real NOT NULL DEFAULT 0,
  dominant_emotion text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient content-level aggregation
CREATE INDEX idx_reactions_content_id ON reactions (content_id);

-- Index for session lookups
CREATE INDEX idx_reactions_session_id ON reactions (session_id);
```

**Row Level Security:**

```sql
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reactions (anonymous visitors)
CREATE POLICY "Allow anonymous inserts"
  ON reactions FOR INSERT
  WITH CHECK (true);

-- Anyone can read reactions (for aggregate queries)
CREATE POLICY "Allow anonymous reads"
  ON reactions FOR SELECT
  USING (true);

-- No updates or deletes from client
-- (Only accessible via Supabase dashboard / service role key)
```

### 4.3 Aggregate View

A database view pre-computes per-content aggregate scores for efficient dashboard queries:

```sql
CREATE VIEW content_rankings AS
SELECT
  content_id,
  COUNT(*) as total_reactions,
  AVG(happy) as avg_happy,
  AVG(sad) as avg_sad,
  AVG(angry) as avg_angry,
  AVG(disgusted) as avg_disgusted,
  AVG(fearful) as avg_fearful,
  AVG(surprised) as avg_surprised,
  MODE() WITHIN GROUP (ORDER BY dominant_emotion) as most_common_emotion
FROM reactions
GROUP BY content_id;
```

### 4.4 Writing Scores

Scores are written at the **Question 3 → Question 4 transition** — the moment the user confirms or denies the emotion prediction. This is the natural end of the content-viewing + detection cycle.

**Integration point:** In `typing.js`, within the Q3 Y/N handler (lines 23-31), after setting `guessCorrect`, call a new `submitReaction()` function.

**`submitReaction()` implementation** (new function in `variables.js`):

```javascript
function submitReaction() {
  if (!currentContentId) return;

  var sessionId = sessionStorage.getItem('ernest_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ernest_session_id', sessionId);
  }

  // Normalize current emotion scores to 0-1 range
  var total = totalEmotionsRead || 1;
  var reactionData = {
    content_id: currentContentId,
    session_id: sessionId,
    happy: emotions.happy / total,
    sad: emotions.sad / total,
    angry: emotions.anger / total,
    disgusted: emotions.disgust / total,
    fearful: emotions.fear / total,
    surprised: emotions.surprise / total,
    dominant_emotion: maxEmotion.emotion
  };

  supabase.from('reactions').insert(reactionData)
    .then(function(result) {
      if (result.error) console.warn('Score submit failed:', result.error);
    });
}
```

**Key considerations:**
- Submission is fire-and-forget — it should not block the UX flow
- `session_id` persists across resets within the same browser tab (via `sessionStorage`)
- Emotion keys in the DB use consistent naming (`angry` not `anger`, `disgusted` not `disgust`) — the submit function maps from the app's internal names
- `dominant_emotion` comes from `maxEmotion.emotion` which is set during Q3 tracking

### 4.5 Reading Aggregate Scores

Two query functions support the report card enhancement and dashboard:

**`fetchContentRanking(contentId)`** — returns ranking data for a single content item:

```javascript
function fetchContentRanking(contentId) {
  return supabase
    .from('content_rankings')
    .select('*')
    .eq('content_id', contentId)
    .single();
}
```

**`fetchAllRankings()`** — returns all content rankings for the dashboard:

```javascript
function fetchAllRankings() {
  return supabase
    .from('content_rankings')
    .select('*')
    .order('total_reactions', { ascending: false });
}
```

---

## 5. Feature 3: Report Card Enhancement

### 5.1 Collective Context in Results

After the existing per-session report card content displays, add a collective ranking line that shows how the just-viewed content performs across all visitors.

**Trigger:** During `showAnalytics()` (Question 4), after displaying the user's emotion prediction, fetch and show the content's collective ranking.

**Display format** (appended below the existing `#guessResult` text):

```
───────────────────
ACROSS ALL VISITORS:
This image ranks #3 for HAPPINESS
47 total reactions
───────────────────
```

### 5.2 Implementation

**New DOM element** in the `#analytics` window (`index.html`):

```html
<div id="collectiveResult" style="display:none;">
  <hr>
  <p class="caps">Across All Visitors:</p>
  <p id="contentRank"></p>
  <p id="totalReactions"></p>
</div>
```

**Logic** (in `analytics.js`, within or after `showAnalytics()`):

1. Call `fetchContentRanking(currentContentId)`
2. Determine rank: fetch all content rankings for the dominant emotion, sort descending, find position of current content
3. Populate `#contentRank` with "This image ranks #N for [EMOTION]"
4. Populate `#totalReactions` with "N total reactions"
5. Show `#collectiveResult`

**Edge case:** If no collective data exists yet (first reaction to this content), display "You're the first to react to this!" instead of a ranking.

### 5.3 Ranking Calculation

To determine rank for a specific emotion:

```javascript
function fetchEmotionRank(contentId, emotion) {
  return supabase
    .from('content_rankings')
    .select('content_id, avg_' + emotion)
    .order('avg_' + emotion, { ascending: false })
    .then(function(result) {
      if (result.error || !result.data) return null;
      var rank = result.data.findIndex(function(r) {
        return r.content_id === contentId;
      });
      return rank === -1 ? null : rank + 1;
    });
}
```

---

## 6. Feature 4: Dashboard ([D] Key)

### 6.1 Activation

- **[D] key** toggles the dashboard overlay on/off
- **[ESC] key** also dismisses the dashboard (existing ESC handler already calls `resetAlize()` — dashboard should close before reset triggers)
- Dashboard is available at any point during the experience

### 6.2 Layout

The dashboard is a full-screen overlay matching the existing window style:

```
┌─────────────────────────────────────────────────┐
│ ░▒▓ HAPPINESS MODEL ▓▒░                    [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Filter: [ALL] [HAPPY] [SAD] [ANGRY]            │
│          [DISGUSTED] [FEARFUL] [SURPRISED]       │
│                                                 │
│  ┌────┐                                         │
│  │ #1 │  baby-otter-01.gif                      │
│  │    │  HAPPY ████████░░ 0.82                   │
│  │    │  SAD   ██░░░░░░░░ 0.21                   │
│  │    │  ...                                     │
│  │    │  47 reactions                            │
│  └────┘                                         │
│                                                 │
│  ┌────┐                                         │
│  │ #2 │  kitten-04.gif                          │
│  │    │  HAPPY ███████░░░ 0.73                   │
│  │    │  ...                                     │
│  │    │  31 reactions                            │
│  └────┘                                         │
│                                                 │
│  [↑/↓] Scroll  [1-6] Filter  [D/ESC] Close      │
└─────────────────────────────────────────────────┘
```

### 6.3 DOM Structure

New elements in `index.html`:

```html
<div id="dashboard" class="hoverWindow grassTheme" style="display:none; overflow:hidden;">
  <div class="windowbar">
    <span>HAPPINESS MODEL</span>
    <span class="windowButtons">
      <span class="x">X</span>
    </span>
  </div>
  <div class="infoBox">
    <div id="dashboardFilters" class="caps"></div>
    <div id="dashboardList"></div>
    <div id="dashboardControls" class="caps">
      [&uarr;/&darr;] Scroll &nbsp; [1-6] Filter &nbsp; [D/ESC] Close
    </div>
  </div>
</div>
```

### 6.4 Dashboard Data & Rendering

**New file: `js/dashboard.js`**

This module handles dashboard state and rendering:

```javascript
var dashboardState = {
  visible: false,
  filter: 'all',        // 'all' | 'happy' | 'sad' | 'angry' | 'disgusted' | 'fearful' | 'surprised'
  scrollIndex: 0,        // Top visible item index
  rankings: [],          // Cached ranking data
  manifest: null         // Reference to contentManifest for thumbnails
};
```

**Core functions:**

| Function | Description |
|----------|-------------|
| `toggleDashboard()` | Show/hide dashboard; fetch rankings on show |
| `renderDashboard()` | Build ranked list HTML from `dashboardState.rankings` |
| `filterDashboard(emotion)` | Set filter, re-sort rankings by that emotion's average, re-render |
| `scrollDashboard(direction)` | Move `scrollIndex` up/down, re-render visible window |

**Rendering each item:**

For each content item in the sorted rankings:

1. **Thumbnail:** `<img>` element with `src="content/{filename}"`, scaled to 80x60px
2. **Rank number:** `#N` prefix
3. **Emotion bars:** Horizontal inline bars (CSS `width` percentage) for each emotion, with numeric value. When a filter is active, highlight the filtered emotion's bar
4. **Reaction count:** `"N reactions"` total

**Sorting:**
- Filter `"all"`: Sort by `total_reactions` descending (most reacted = #1)
- Filter by specific emotion: Sort by `avg_{emotion}` descending (highest average score = #1)

### 6.5 Keyboard Controls

Extend the keyboard handler in `variables.js`:

| Key | Action |
|-----|--------|
| `D` / `d` | Toggle dashboard visibility |
| `ArrowUp` | Scroll dashboard list up |
| `ArrowDown` | Scroll dashboard list down |
| `1` | Filter by happy |
| `2` | Filter by sad |
| `3` | Filter by angry |
| `4` | Filter by disgusted |
| `5` | Filter by fearful |
| `6` | Filter by surprised |
| `0` | Clear filter (show all) |
| `ESC` | Close dashboard (if open, prevent reset) |

**Guard:** Dashboard keyboard controls should only be active when the dashboard is visible (`dashboardState.visible === true`). When the dashboard is not visible, these keys should pass through to existing handlers. The `D` key should not interfere with Y/N input handling (only activate when `listeningForAnswer` is false).

### 6.6 Styling

Dashboard-specific CSS additions in `style/style.css`:

```css
#dashboard .infoBox {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#dashboardFilters {
  padding: 10px 0;
  font-size: 18px;
}

#dashboardFilters .active {
  background: #fbe293;
  color: #357542;
  padding: 2px 6px;
}

#dashboardList {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
}

.dashboard-item {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 10px 0;
  border-bottom: 1px solid #fbe293;
}

.dashboard-item img {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border: 1px solid #fbe293;
}

.dashboard-rank {
  font-size: 24px;
  min-width: 40px;
}

.emotion-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.emotion-bar {
  height: 8px;
  background: #fbe293;
  transition: width 0.3s;
}

.emotion-bar-track {
  width: 100px;
  height: 8px;
  background: rgba(251, 226, 147, 0.2);
}

#dashboardControls {
  padding: 10px 0;
  font-size: 14px;
  border-top: 1px solid #fbe293;
}
```

---

## 7. Files Summary

### New Files

| File | Purpose |
|------|---------|
| `content/` | Directory for curated images and GIFs |
| `content-manifest.json` | Generated manifest of content items |
| `scripts/generate-manifest.js` | Node.js script to build manifest from `content/` directory |
| `js/dashboard.js` | Dashboard rendering, state management, keyboard controls |
| `docs/PRD-happiness-model.md` | This document |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Add Supabase CDN script tag; add `#collectiveResult` element in `#analytics`; add `#dashboard` overlay HTML; add `dashboard.js` script tag |
| `js/variables.js` | Add Supabase client initialization; add `contentManifest`, `currentContentId`, `sessionShownContent` globals; replace `gifSrc()` with `selectContent()`; preserve `gifSrc()` as fallback; add `submitReaction()` function; add `D` key handler; modify ESC handler to check dashboard state |
| `js/typing.js` | Call `submitReaction()` in Q3 Y/N handler after setting `guessCorrect` |
| `js/analytics.js` | In `showAnalytics()`, fetch and display collective ranking for current content |
| `style/style.css` | Add dashboard-specific styles |

### Unchanged Files

All vendor libraries, shaders, Three.js setup, emotion detection pipeline, face tracking, bar chart, and core animation loop remain unchanged.

---

## 8. Implementation Phases

### Phase 1: Content Repository
1. Create `content/` directory and seed with 10-15 curated GIFs/images
2. Write `scripts/generate-manifest.js`
3. Generate initial `content-manifest.json`
4. Replace `gifSrc()` with manifest-driven `selectContent()` in `variables.js`
5. Test: verify content loads from local files, no Giphy API calls, fallback works

### Phase 2: Score Storage
1. Create Supabase project, configure `reactions` table and `content_rankings` view
2. Set up Row Level Security policies
3. Add Supabase CDN script tag to `index.html`
4. Add Supabase client initialization to `variables.js`
5. Implement `submitReaction()` and wire into Q3 → Q4 transition in `typing.js`
6. Test: verify reactions appear in Supabase dashboard after completing a session

### Phase 3: Report Card Enhancement
1. Add `#collectiveResult` DOM elements to `#analytics` in `index.html`
2. Implement `fetchContentRanking()` and `fetchEmotionRank()` in `variables.js`
3. Update `showAnalytics()` in `analytics.js` to fetch and display collective data
4. Test: verify ranking displays correctly, handles zero-data edge case

### Phase 4: Dashboard
1. Add `#dashboard` HTML to `index.html`
2. Create `js/dashboard.js` with state management and rendering
3. Add dashboard CSS to `style/style.css`
4. Wire keyboard handlers (`D`, arrow keys, number keys) in `variables.js`
5. Add `dashboard.js` script tag to `index.html` (before `composer.js`)
6. Test: verify dashboard opens, displays rankings, filters work, scrolling works

### Phase 5: Deploy
1. Configure Netlify site (connect GitHub repo, set publish directory to root)
2. Set custom domain if desired
3. Verify Supabase connection works from deployed URL (check CORS)
4. Smoke test full flow: visit → react → scores stored → dashboard shows rankings

---

## 9. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Manifest fetch fails | Fall back to Giphy API (`gifSrcFallback()`) |
| Supabase unreachable | Log warning to console; experience continues without persistence |
| Score submit fails | Log warning; do not block UX flow |
| No reactions in database yet | Dashboard shows "No reactions yet — be the first!" |
| Single content item in library | Still functions; dashboard shows one item |
| Content file missing from `content/` | `<img>` shows broken image; manifest generator should validate files exist |
| Very long session (many retries) | `sessionShownContent` resets when all items exhausted; same content may repeat |
| Concurrent sessions | Each has unique `session_id` via `sessionStorage`; no conflicts |
| Page auto-refresh (20-min meta tag) | `sessionStorage` persists across refresh; session_id carries over |
| `D` pressed during Y/N prompt | `listeningForAnswer` guard prevents dashboard activation |

---

## 10. Future Considerations

These are explicitly **out of scope** for this PRD but noted for future reference:

- **Content tagging and categories**: Filter dashboard by content tags (animal type, etc.)
- **Time-based trending**: "Trending this week" vs. all-time rankings
- **Content submission**: Let visitors suggest new content items
- **A/B testing**: Show different content to different users and compare emotional responses
- **Export/API**: Expose aggregate data as a public API endpoint
- **Admin dashboard**: Protected view for managing content and reviewing data
- **Rate limiting enhancements**: IP-based throttling in Edge Function is basic; could add CAPTCHA or fingerprinting

---

## Addendum A: Security Hardening for Public Deployment

**Date:** 2026-02-08
**Context:** ERNEST will be deployed as a public web demo. The original PRD had the Supabase anon key hardcoded in `variables.js` with an open INSERT RLS policy, which would allow anyone to script fake reactions directly against the database.

### Problem

With a public repo and public deployment:
1. The Supabase anon key is visible in browser source and in git history
2. An open INSERT policy lets anyone write arbitrary data to `reactions`
3. Rankings can be trivially gamed; free tier storage/bandwidth can be exhausted

### Solution: Edge Function Proxy

All **writes** now go through a Supabase Edge Function. The browser never gets direct write access to the database. **Reads** remain client-side via the anon key (reading aggregate rankings is not a security concern).

```
Browser                          Supabase
  │                                │
  │── POST /functions/v1/          │
  │   submit-reaction ───────────► │ Edge Function (Deno)
  │                                │   ├── Validate payload
  │                                │   ├── Rate limit by IP
  │                                │   └── INSERT via service role key
  │                                │         (bypasses RLS)
  │                                │
  │── Supabase JS SDK ──────────► │ Direct read (anon key)
  │   SELECT content_rankings      │   RLS allows SELECT only
  │                                │
```

### Architecture Changes from Original PRD

| Area | Original | Updated |
|------|----------|---------|
| **Writes** | Supabase JS client with anon key, open INSERT RLS | `fetch()` POST to Edge Function; no INSERT RLS policy |
| **Reads** | Supabase JS client with anon key | Unchanged — anon key for SELECT only |
| **Credentials in code** | Hardcoded `SUPABASE_URL` and `SUPABASE_ANON_KEY` | `%%PLACEHOLDER%%` tokens replaced at build time |
| **Credentials in repo** | Committed in `variables.js` | Never committed; set as Netlify environment variables |
| **Rate limiting** | None (listed as future) | Implemented in Edge Function: 10 requests/minute/IP |
| **Payload validation** | None | Edge Function validates all fields, score ranges, emotion values |

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/submit-reaction/index.ts` | Deno Edge Function: validates payload, rate limits by IP, writes via service role key |
| `scripts/build.sh` | Netlify build script: replaces `%%PLACEHOLDER%%` tokens in `variables.js` with env vars |
| `netlify.toml` | Netlify build configuration |

### Modified Files

| File | Change |
|------|--------|
| `js/variables.js` | `submitReaction()` now uses `fetch()` to POST to Edge Function instead of Supabase JS client; credentials use `%%PLACEHOLDER%%` tokens |
| `scripts/supabase-setup.sql` | Removed anonymous INSERT policy; only SELECT policy remains |

### Edge Function Details

**File:** `supabase/functions/submit-reaction/index.ts`

**Protections:**
- **Rate limiting:** In-memory map, 10 requests per minute per IP (resets on cold start)
- **Payload validation:** Checks all required fields exist, scores are numbers in 0-1 range, `dominant_emotion` is one of the 6 valid emotions + "unsure"
- **Method restriction:** Only POST accepted
- **CORS headers:** Included for cross-origin requests from Netlify domain
- **Service role key:** Used server-side only, never exposed to browser; set automatically by Supabase runtime

**Deployment:**
```bash
# Install Supabase CLI
npm install -g supabase

# Login and link to project
supabase login
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy submit-reaction
```

### Build Pipeline

**`scripts/build.sh`** runs during Netlify deploy and replaces placeholder tokens:

```
js/variables.js (in repo)          js/variables.js (deployed)
──────────────────────────         ──────────────────────────
var SUPABASE_URL =                 var SUPABASE_URL =
  '%%SUPABASE_URL%%';        →      'https://xyz.supabase.co';
var SUPABASE_ANON_KEY =            var SUPABASE_ANON_KEY =
  '%%SUPABASE_ANON_KEY%%';   →      'eyJ...actual-key...';
```

**Netlify environment variables to set** (Site settings > Environment variables):

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Found in Supabase Settings > API |
| `SUPABASE_ANON_KEY` | `eyJ...` | The **anon/public** key (safe for reads) |

The **service role key** is never set in Netlify — it lives only in the Supabase Edge Function runtime environment, where it is automatically available.

### Updated Deployment Steps (replaces Phase 5)

1. Create Supabase project and run `scripts/supabase-setup.sql` in SQL Editor
2. Deploy Edge Function: `supabase functions deploy submit-reaction`
3. Connect GitHub repo to Netlify
4. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify environment variables
5. Deploy — `scripts/build.sh` runs automatically, injecting credentials
6. Verify: submit a reaction, check Supabase dashboard for the row
7. Verify: open DevTools on deployed site, confirm no service role key is exposed

### Remaining Risks (accepted)

- **Anon key in deployed JS:** Visible via view-source but only grants SELECT on `reactions`. Rankings are public data by design.
- **Rate limit resets on cold start:** Supabase Edge Functions may cold-start frequently on free tier. A determined attacker could spread requests across cold starts. For an art installation demo, this is acceptable.
- **No origin validation:** The Edge Function accepts requests from any origin. Could add `Origin` header checking for the Netlify domain, but this is easily spoofed and provides minimal real protection.
