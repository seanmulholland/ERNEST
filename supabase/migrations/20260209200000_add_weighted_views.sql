-- Add weighted and confirmed-only content ranking views
-- Weight design: confirmed = 1.0, rejected/legacy (false or NULL) = 0.25

-- Weighted content rankings: SUM(score * weight) / SUM(weight)
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
