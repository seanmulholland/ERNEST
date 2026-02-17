# PRD: Synthetic Reaction Data

**Project:** ERNEST
**Feature:** Seed the reactions database with synthetic data so the dashboard looks populated on launch
**Authors:** Sean Mulholland, Matt Visco
**Status:** Complete
**Date:** 2026-02-17

---

## 1. Overview

Before real visitors generate reaction data, the dashboard and content rankings appear empty. Synthetic data seeds every content item with a baseline of reactions so the experience feels populated from day one. The data is designed to **cancel out** — emotion scores are uniformly distributed so that a small number of real human reactions quickly shift the rankings.

### Goals

- Populate every content item with enough reactions to render meaningfully in the dashboard
- Ensure synthetic data does not skew rankings toward any emotion (flat baseline)
- Give `arf-willamette-final` a slight edge so it ranks #1 initially
- Tag synthetic rows so they can be purged later without affecting real data
- Keep the generation reproducible and re-runnable as content is added

### Non-Goals

- Synthetic data does not need to look statistically indistinguishable from real data
- No runtime code changes — the app treats synthetic rows the same as any other row
- No automated pipeline — generation and loading are manual steps

---

## 2. Schema Change

A new boolean column on `reactions`:

```sql
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS is_synthetic boolean DEFAULT false;
```

- Defaults to `false`, so all real reactions are unaffected
- Not referenced by any app code, views, or queries
- Exists solely as a filter for manual cleanup: `DELETE FROM reactions WHERE is_synthetic = true;`

The column is also reflected in `scripts/supabase-setup.sql` for fresh installs.

---

## 3. Data Design

### Volume

- **23 rows per content item** (~437 total for 19 images)
- ~8 confirmed (`user_confirmed = true`), ~15 unconfirmed per image
- In the weighted view, unconfirmed rows carry 0.25x weight, so 23 synthetic rows have an effective weight of ~11.75 — meaning 3-4 real confirmed reactions will outweigh the synthetic baseline

### Emotion Distribution (Normal Content)

Each of the 6 emotions (`happy`, `sad`, `angry`, `disgusted`, `fearful`, `surprised`) appears as dominant ~3-4 times across the 23 rows. Per-row scores:

| Field | Value |
|-------|-------|
| Dominant emotion score | 0.35 - 0.55 (random) |
| Remaining 5 emotions | Split remaining weight with random noise |

This produces a flat average of ~0.167 per emotion per content item — no single emotion dominates.

### Boosted Content (`arf-willamette-final`)

- `happy` appears as dominant emotion **6 times** (vs ~3-4 for normal content)
- Happy-dominant rows get a +0.08 score bump (score range 0.43 - 0.63 instead of 0.35 - 0.55)
- Result: `arf-willamette-final` ranks #1 for happiness, but only by a small margin that a handful of real reactions can overtake

### Timestamps

- `created_at` spread randomly over the past 7 days for realistic-looking time distribution

### Session IDs

- Each row gets a unique random hex session ID (16 chars) — no session reuse

---

## 4. Generation Script

**Location:** `scripts/generate-synthetic-data.js`

**Usage:**
```bash
node scripts/generate-synthetic-data.js
```

**Output:** `scripts/synthetic-data.sql`

The script:
1. Reads `content-manifest.json` for the list of content IDs
2. Generates 23 rows per content item with balanced emotions
3. Applies the boost to content IDs listed in `BOOSTED_IDS` (currently just `arf-willamette-final`)
4. Outputs a self-contained SQL file that includes the `ALTER TABLE` and all `INSERT` statements

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ROWS_PER_IMAGE` | 23 | Reactions per content item |
| `BOOSTED_IDS` | `['arf-willamette-final']` | Content that gets a happy bias |
| Confirmed ratio | ~8/23 | Proportion of `user_confirmed = true` |
| Dominant score range | 0.35 - 0.55 | Base range for the dominant emotion |
| Boost amount | +0.08 | Added to dominant score for boosted happy rows |

---

## 5. Deployment Steps

### First-time setup or full reset

Run these in the **Supabase SQL Editor** in order:

```sql
-- 1. Clear existing test data
DELETE FROM reactions;

-- 2. Paste and run the contents of scripts/synthetic-data.sql
--    (includes ALTER TABLE + INSERT statements)
```

### After adding new content

```bash
# 1. Add images to content/
# 2. Regenerate manifest
node scripts/generate-manifest.js

# 3. Regenerate synthetic data
node scripts/generate-synthetic-data.js

# 4. In Supabase SQL Editor:
DELETE FROM reactions WHERE is_synthetic = true;
-- Then paste and run scripts/synthetic-data.sql
```

### Purging synthetic data (once enough real data exists)

```sql
DELETE FROM reactions WHERE is_synthetic = true;
```

---

## 6. How Real Data Overtakes Synthetic

The synthetic baseline is intentionally weak:

1. **Flat emotions**: ~0.167 avg per emotion means no content has a meaningful lead
2. **Low effective weight**: 15 unconfirmed rows at 0.25x weight + 8 confirmed = ~11.75 effective weight in the weighted view
3. **Real confirmed reactions carry 1.0x weight**: Just 4-5 real confirmed reactions produce enough weight (~4-5) to meaningfully shift a content item's ranking
4. **Confirmed-only view ignores unconfirmed**: In the `confirmed_content_rankings` view, only the 8 synthetic confirmed rows count — a few real confirmed reactions quickly dominate

This means the synthetic data makes the dashboard look alive without predetermining which content "wins."
