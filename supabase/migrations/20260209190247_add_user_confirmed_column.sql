-- Add user_confirmed column to track whether user agreed with emotion prediction
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS user_confirmed boolean DEFAULT NULL;

-- Recreate content_rankings view to include confirmed reaction counts
DROP VIEW IF EXISTS content_rankings;
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
