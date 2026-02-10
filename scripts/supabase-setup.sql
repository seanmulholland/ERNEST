-- Supabase setup for ERNEST Happiness Model
-- Run this in the Supabase SQL Editor after creating your project

-- Reactions table: stores one row per content viewing
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
  user_confirmed boolean DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_reactions_content_id ON reactions (content_id);
CREATE INDEX idx_reactions_session_id ON reactions (session_id);

-- Row Level Security
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Anonymous users can ONLY read reactions (for aggregate queries and dashboard)
-- Inserts are handled by the Edge Function using the service role key,
-- which bypasses RLS entirely. No anonymous insert policy needed.
CREATE POLICY "Allow anonymous reads"
  ON reactions FOR SELECT
  USING (true);

-- No INSERT, UPDATE, or DELETE policies for anonymous users.
-- All writes go through the submit-reaction Edge Function (server-side, service role).

-- Aggregate view: pre-computed per-content rankings
CREATE VIEW content_rankings AS
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

-- Weighted content rankings: confirmed reactions weighted 1.0, rejected/legacy weighted 0.25
CREATE VIEW weighted_content_rankings AS
SELECT
  content_id,
  COUNT(*) as total_reactions,
  COUNT(*) FILTER (WHERE user_confirmed = true) as confirmed_reactions,
  SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END) as total_weight,
  SUM(happy * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_happy,
  SUM(sad * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_sad,
  SUM(angry * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_angry,
  SUM(disgusted * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_disgusted,
  SUM(fearful * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_fearful,
  SUM(surprised * CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END)
    / NULLIF(SUM(CASE WHEN user_confirmed = true THEN 1.0 ELSE 0.25 END), 0) as avg_surprised,
  MODE() WITHIN GROUP (ORDER BY dominant_emotion) as most_common_emotion
FROM reactions
GROUP BY content_id;

-- Confirmed-only content rankings: simple AVG over confirmed rows only
CREATE VIEW confirmed_content_rankings AS
SELECT
  content_id,
  COUNT(*) as total_reactions,
  COUNT(*) as confirmed_reactions,
  AVG(happy) as avg_happy,
  AVG(sad) as avg_sad,
  AVG(angry) as avg_angry,
  AVG(disgusted) as avg_disgusted,
  AVG(fearful) as avg_fearful,
  AVG(surprised) as avg_surprised,
  MODE() WITHIN GROUP (ORDER BY dominant_emotion) as most_common_emotion
FROM reactions
WHERE user_confirmed = true
GROUP BY content_id;
