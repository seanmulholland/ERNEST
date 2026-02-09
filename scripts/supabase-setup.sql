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
  AVG(happy) as avg_happy,
  AVG(sad) as avg_sad,
  AVG(angry) as avg_angry,
  AVG(disgusted) as avg_disgusted,
  AVG(fearful) as avg_fearful,
  AVG(surprised) as avg_surprised,
  MODE() WITHIN GROUP (ORDER BY dominant_emotion) as most_common_emotion
FROM reactions
GROUP BY content_id;
