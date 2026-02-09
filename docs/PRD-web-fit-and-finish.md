# PRD: Web Fit + Finish

**Project:** ERNEST
**Feature:** Scoring accuracy refactor, user confirmation tracking, and UX polish
**Authors:** Sean Mulholland, Matt Visco
**Status:** Draft
**Date:** 2026-02-09
**Branch:** `Web-Fit-and-Finish`

---

## 1. Overview

This PRD covers the second phase of ERNEST development, focused on improving the accuracy and reliability of the emotion scoring system, adding user feedback tracking, and polishing the web experience. It builds on the Happiness Model infrastructure (see `docs/PRD-happiness-model.md`).

### Goals

- Replace the peak-frame confidence score with a session-average confidence score
- Track user confirmation (Y/N) as a `user_confirmed` flag in the database
- Fix a data-scope bug where emotion accumulators include non-Q3 frames and bleed across image rounds
- Lay groundwork for future weighted scoring and UI refinements

### Non-Goals

- Weighted scoring of confirmed vs. unconfirmed reactions (documented for future addendum)
- UI/visual redesign (documented for future addendum)
- Changes to the emotion detection model or CLMtrackr pipeline
- Per-user accounts or authentication

---

## 2. Problem Statement

### 2.1 Confidence Score Uses Peak, Not Average

**Current behavior:** During Q3 (image viewing), `updateMaxEmotion()` in `emotional_analysis.js` tracks the **single highest emotion value** across all frames. When ERNEST says "I am XX% confident that made you happy", the percentage comes from one peak frame — which may be a jitter outlier, not representative of the user's sustained reaction.

**Code path:**
1. `trackingLoop()` → `updateMaxEmotion(er, emotionValues)` (`emotional_analysis.js:44`)
2. If `er[max].value > maxEmotion.value` during Q3, replace `maxEmotion` (`emotional_analysis.js:62-67`)
3. `emotionScore()` displays `Math.round(maxEmotion.value * 100)` (`typing.js:136`)

**Desired behavior:** The confidence score should reflect the **average emotion intensity** across the entire Q3 viewing session, and the predicted emotion should be whichever has the **highest average**.

### 2.2 User Confirmation Not Stored

**Current behavior:** After ERNEST states its confidence, the user types Y or N. The `guessCorrect` boolean controls the display text in `guessUpdate()` (`analytics.js:53-65`) but is **never sent to the database**. Both Y and N trigger `submitReaction()` with identical data.

**Desired behavior:** Store `user_confirmed: true/false` in the `reactions` table so downstream analytics can filter or weight based on user agreement.

### 2.3 Emotion Accumulator Scope Bug

**Current behavior:** `updateEmotionsAverage()` runs on **every frame** regardless of question state (`emotional_analysis.js:45`), and `emotions`/`totalEmotionsRead` are only reset in `resetAlize()` (full reset). When a user tries another image via the Q5→Q2 loop, the second image's submitted scores include accumulated data from the first image and from non-Q3 frames.

**Impact:** Submitted emotion averages (`emotions[key] / totalEmotionsRead`) are diluted by irrelevant frames and contaminated by previous images.

---

## 3. Solution: Q3-Scoped Emotion Tracking

### 3.1 New Global Variables

Add Q3-specific accumulators alongside the existing ones (the existing `emotions`/`totalEmotionsRead` are still used by `calculateBaslineFace()` for the report card and must remain unchanged):

**File:** `js/variables.js`

```javascript
var q3Emotions = { anger: 0, disgust: 0, fear: 0, sad: 0, surprise: 0, happy: 0 };
var q3FrameCount = 0;
```

### 3.2 Q3-Gated Accumulation

**File:** `js/emotional_analysis.js`

Gate the new accumulator to only run during Q3, matching how `updateData(er)` is already gated:

```javascript
// In trackingLoop(), inside the `if (er)` block:
if (currentQuestion == 3) {
  updateData(er);
  updateQ3Emotions(emotionValues);  // NEW
}
```

New function:

```javascript
function updateQ3Emotions(emotionValues) {
  var index = 0;
  for (var key in q3Emotions) {
    q3Emotions[key] += emotionValues[index];
    index++;
  }
  q3FrameCount++;
}
```

### 3.3 Average-Based Confidence Score

**File:** `js/typing.js`

Refactor `emotionScore()` to compute averages from Q3 data and pick the highest:

```javascript
function emotionScore() {
  var total = q3FrameCount || 1;
  var bestEmotion = 'unsure';
  var bestValue = 0;

  for (var key in q3Emotions) {
    var avg = q3Emotions[key] / total;
    if (avg > bestValue) {
      bestValue = avg;
      bestEmotion = key;
    }
  }

  // Map internal names to display names
  var displayName = mapEmotionName(bestEmotion);
  maxEmotion = { emotion: displayName, value: bestValue };
  maxEmotionVal = Math.round(bestValue * 100);

  var calculatedEmotion = "> I am " + maxEmotionVal + "% confident that made you "
    + maxEmotion.emotion + ". Does that sound right?";
  typeSentence(calculatedEmotion, 0, yesOrNo);
}
```

### 3.4 Emotion Name Mapping

**File:** `js/variables.js`

The `q3Emotions` object uses internal keys (`anger`, `disgust`, `fear`) while the display and database use different names (`angry`, `disgusted`, `fearful`). Add a mapper:

```javascript
function mapEmotionName(key) {
  var nameMap = {
    anger: 'angry',
    disgust: 'disgusted',
    fear: 'fearful',
    sad: 'sad',
    surprise: 'surprised',
    happy: 'happy'
  };
  return nameMap[key] || key;
}
```

### 3.5 Snapshot Behavior (Unchanged)

`takeSnapshot()` is called inside `updateMaxEmotion()` at peak emotion moments during Q3. This captures an interesting facial expression for the analytics display. This behavior is cosmetic and remains unchanged — `updateMaxEmotion()` continues to run during Q3 for snapshot purposes, but the peak value is no longer used for the confidence score.

### 3.6 Reset Between Rounds

**File:** `js/variables.js`

Add a helper to reset Q3 accumulators:

```javascript
function resetQ3Emotions() {
  q3Emotions = { anger: 0, disgust: 0, fear: 0, sad: 0, surprise: 0, happy: 0 };
  q3FrameCount = 0;
}
```

Call `resetQ3Emotions()` in:
- `resetAlize()` — full experience reset
- The Y-at-Q6 handler in `typing.js` — when user tries another image without full reset

---

## 4. Solution: User Confirmation Flag

### 4.1 Database Schema Change

**File:** `scripts/supabase-setup.sql`

Add column to `reactions` table:

```sql
ALTER TABLE reactions ADD COLUMN user_confirmed boolean DEFAULT NULL;
```

Update `content_rankings` view to include confirmation counts:

```sql
CREATE OR REPLACE VIEW content_rankings AS
SELECT
  content_id,
  COUNT(*) as total_reactions,
  COUNT(*) FILTER (WHERE user_confirmed = true) as confirmed_reactions,
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

### 4.2 Edge Function Update

**File:** `supabase/functions/submit-reaction/index.ts`

- Accept `user_confirmed` in the request body (boolean or null)
- Validate type if present
- Include in the INSERT statement

### 4.3 Client Submission Update

**File:** `js/variables.js`

Update `submitReaction()` to use Q3-scoped data and include the confirmation flag:

```javascript
function submitReaction() {
  if (!currentContentId || !SUPABASE_URL || SUPABASE_URL.indexOf('%%') !== -1) return;

  var sessionId = sessionStorage.getItem('ernest_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ernest_session_id', sessionId);
  }

  var total = q3FrameCount || 1;
  var reactionData = {
    content_id: currentContentId,
    session_id: sessionId,
    happy: q3Emotions.happy / total,
    sad: q3Emotions.sad / total,
    angry: q3Emotions.anger / total,
    disgusted: q3Emotions.disgust / total,
    fearful: q3Emotions.fear / total,
    surprised: q3Emotions.surprise / total,
    dominant_emotion: maxEmotion.emotion,
    user_confirmed: guessCorrect          // NEW
  };

  // ...POST to Edge Function (unchanged)...
}
```

---

## 5. Files Summary

### Modified Files

| File | Changes |
|------|---------|
| `js/variables.js` | Add `q3Emotions`, `q3FrameCount` globals; add `resetQ3Emotions()` and `mapEmotionName()` helpers; call `resetQ3Emotions()` in `resetAlize()`; update `submitReaction()` to use Q3 data + `user_confirmed` |
| `js/emotional_analysis.js` | Add `updateQ3Emotions()` function; call it inside Q3 gate in `trackingLoop()` |
| `js/typing.js` | Refactor `emotionScore()` to compute averages from `q3Emotions`; call `resetQ3Emotions()` in Y-at-Q6 handler |
| `scripts/supabase-setup.sql` | Add `user_confirmed` column; update `content_rankings` view with `confirmed_reactions` count |
| `supabase/functions/submit-reaction/index.ts` | Validate and insert `user_confirmed` field |

### Unchanged Files

| File | Why unchanged |
|------|---------------|
| `js/analytics.js` | Already reads from `maxEmotion` which we update at prediction time |
| `js/composer.js` | Question flow sequencing unchanged |
| `js/dashboard.js` | Reads from `content_rankings` view; schema change is additive |
| `index.html` | No DOM changes needed |
| `js/vendors/*` | Emotion detection pipeline unchanged |

---

## 6. Verification

| Test | Steps | Expected |
|------|-------|----------|
| Average-based confidence | Go through Q0→Q3, view image, proceed to prediction | Confidence % reflects sustained emotion, not a spike; value should be more moderate than before |
| Correct emotion label | View a cute image, check predicted emotion | Should match the emotion with the highest average, not just the highest single frame |
| Y confirmation | Type Y at prediction prompt, check browser console | `submitReaction()` logs with `user_confirmed: true` |
| N confirmation | Type N at prediction prompt, check browser console | `submitReaction()` logs with `user_confirmed: false` |
| Multi-round isolation | Try another image (Y at Q5), complete second round | Second image's confidence % reflects only the second image's Q3 data |
| Report card baseline | Complete full experience, check report card | Baseline face calculation still works (uses `emotions`/`totalEmotionsRead`, not Q3 vars) |
| Dashboard | Press D, verify rankings display | Dashboard reads from `content_rankings` view; `confirmed_reactions` column available |
| Snapshot still works | During Q3, make exaggerated expressions | Snapshot captures peak expression moments (cosmetic, unchanged) |

---

## 7. Edge Cases

| Scenario | Handling |
|----------|----------|
| Zero Q3 frames (user skips quickly) | `q3FrameCount || 1` prevents division by zero; confidence will be 0% |
| All emotions equally low | Whichever emotion key comes first in iteration wins; acceptable for near-zero cases |
| `guessCorrect` undefined (user never answers) | `user_confirmed` will be `undefined`/null in payload; Edge Function accepts null |
| Existing reactions without `user_confirmed` | Column defaults to NULL; queries using `FILTER (WHERE user_confirmed = true)` naturally exclude old rows from confirmed counts |

---

## 8. Future Addendums

This section reserves topics for future addendums to this PRD. Each will be appended as a lettered addendum (Addendum A, B, etc.) when work begins.

### Addendum A — Weighted Scoring for Confirmed vs. Unconfirmed Reactions

**Status:** Implemented
**Branch:** `Web-Fit-and-Finish`

#### Weight Design

Every submitted reaction has `user_confirmed` set to `true` or `false` — there is no code path that submits without an answer. (If the user times out, `resetAlize()` fires without calling `submitReaction()`.) Any legacy NULL rows from before the column was added are treated as rejected.

| Tier | `user_confirmed` | Weight | Rationale |
|------|-------------------|--------|-----------|
| Confirmed | `true` | **1.0** | User validated the prediction. Gold standard. |
| Rejected / legacy | `false` or `NULL` | **0.25** | User rejected the prediction, or legacy data without feedback. |

**Why not 0 for rejected?** The raw emotion scores are still real facial observations from CLMtrackr. The camera did see those expressions. What failed is the dominant emotion classification — the user's felt emotion didn't match their face. With a small dataset, discarding 25% of useful signal is better than discarding 100%.

**Why 0.25?** The 4:1 ratio means one confirmed reaction outweighs four rejected ones. In label noise literature, explicitly rejected labels warrant heavy discounting. 0.5 would be too generous — it would mean a coin-flip confidence in data the user explicitly said was wrong.

**Effective ratio example:** 1 confirmed = 4 rejected. A content item with 2 confirmed-happy + 4 rejected-sad reactions: confirmed contributes 2.0 weight (67%), rejected contributes 1.0 weight (33%). Validated data clearly dominates.

#### Database Changes

Two new Postgres views, both outputting the same `avg_*` column names as `content_rankings` so the dashboard rendering code works unchanged — only the data source name changes:

- **`weighted_content_rankings`** — weighted averages using `SUM(score * weight) / SUM(weight)` with the two-tier weights above
- **`confirmed_content_rankings`** — only `user_confirmed = true` rows, simple `AVG()`

The existing `content_rankings` view is unchanged and serves as the "ALL" (unweighted) mode.

Migration file: `supabase/migrations/20260209200000_add_weighted_views.sql`

#### Dashboard Integration

A new data mode toggle cycles through three views:

| Mode | View | Description |
|------|------|-------------|
| ALL | `content_rankings` | Unweighted averages across all reactions |
| WEIGHTED | `weighted_content_rankings` | Confirmed reactions weighted 1.0, rejected/legacy weighted 0.25 |
| CONFIRMED | `confirmed_content_rankings` | Only user-confirmed reactions |

- Default mode: **WEIGHTED**
- Cycle with **W** key (shown in dashboard filter bar and controls hint)
- Emotion filters (0-6, arrows) work independently within each data mode
- In CONFIRMED mode with no confirmed reactions, dashboard shows "No reactions yet"

#### Files Modified

| File | Changes |
|------|---------|
| `js/dashboard.js` | Added `dataMode` state, `DATA_MODES`, `cycleDashboardDataMode()`, `fetchRankingsForMode()`; updated `renderDashboardFilters()` to show mode label; updated `toggleDashboard()` to use mode-aware fetch |
| `js/variables.js` | Added `W` key handler in dashboard keyboard block |
| `index.html` | Added `[W] Data mode` to `#dashboardControls` hint |
| `scripts/supabase-setup.sql` | Added `weighted_content_rankings` and `confirmed_content_rankings` view definitions |
| `supabase/migrations/20260209200000_add_weighted_views.sql` | Migration creating the two views |

### Reserved: Addendum B — UI Tweaks and Visual Polish

**Scope:** Visual and interaction improvements to the web experience. May include:
- Typography and layout refinements
- Animation and transition polish
- Mobile responsiveness
- Accessibility improvements
- Dashboard visual enhancements

### Reserved: Addendum C — [TBD]

Additional addendum slots available as new work items emerge during the Web Fit + Finish phase.
