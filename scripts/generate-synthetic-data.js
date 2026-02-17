#!/usr/bin/env node

// Generates synthetic reaction data for all content in the manifest.
// Produces a .sql file to run in the Supabase SQL Editor.
//
// Usage: node scripts/generate-synthetic-data.js
// Output: scripts/synthetic-data.sql

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var MANIFEST_PATH = path.join(__dirname, '..', 'content-manifest.json');
var OUTPUT_PATH = path.join(__dirname, 'synthetic-data.sql');

var EMOTIONS = ['happy', 'sad', 'angry', 'disgusted', 'fearful', 'surprised'];
var ROWS_PER_IMAGE = 23;

// Content IDs that get a slight happy boost (will rank a bit higher)
var BOOSTED_IDS = ['arf-willamette-final'];

// --- Helpers ---

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function generateSessionId() {
  return crypto.randomBytes(8).toString('hex');
}

// Generate a single reaction row with one dominant emotion.
// Returns { happy, sad, angry, disgusted, fearful, surprised, dominant_emotion }
function generateReaction(dominantEmotion, boost) {
  var scores = {};
  var dominantScore = randomFloat(0.35, 0.55);
  if (boost) dominantScore += 0.08; // slight nudge for boosted content

  // Distribute remaining weight across other emotions with noise
  var remaining = 1.0 - dominantScore;
  var others = EMOTIONS.filter(function(e) { return e !== dominantEmotion; });
  var noise = others.map(function() { return Math.random(); });
  var noiseSum = noise.reduce(function(a, b) { return a + b; }, 0);

  EMOTIONS.forEach(function(e) {
    if (e === dominantEmotion) {
      scores[e] = dominantScore;
    } else {
      var idx = others.indexOf(e);
      scores[e] = remaining * (noise[idx] / noiseSum);
    }
  });

  return {
    happy: scores.happy,
    sad: scores.sad,
    angry: scores.angry,
    disgusted: scores.disgusted,
    fearful: scores.fearful,
    surprised: scores.surprised,
    dominant_emotion: dominantEmotion
  };
}

// Build rows for one content_id.
// For boosted content: happy appears as dominant more often.
// For normal content: each emotion appears ~evenly as dominant.
function generateRowsForContent(contentId, isBoosted) {
  var rows = [];

  // Build a pool of dominant emotions across ROWS_PER_IMAGE rows.
  // Normal: cycle through all 6 emotions evenly (~3-4 each).
  // Boosted: give happy ~6 appearances, others ~3-4 each.
  var pool = [];
  if (isBoosted) {
    // happy gets ~6, others split remaining ~17 => ~3.4 each
    for (var h = 0; h < 6; h++) pool.push('happy');
    var otherEmotions = EMOTIONS.filter(function(e) { return e !== 'happy'; });
    var remaining = ROWS_PER_IMAGE - 6;
    for (var r = 0; r < remaining; r++) {
      pool.push(otherEmotions[r % otherEmotions.length]);
    }
  } else {
    for (var i = 0; i < ROWS_PER_IMAGE; i++) {
      pool.push(EMOTIONS[i % EMOTIONS.length]);
    }
  }

  // Shuffle pool
  for (var s = pool.length - 1; s > 0; s--) {
    var j = Math.floor(Math.random() * (s + 1));
    var tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp;
  }

  // Decide confirmed vs unconfirmed: ~8 confirmed, ~15 unconfirmed
  var confirmedIndices = {};
  var confirmCount = 0;
  while (confirmCount < 8) {
    var idx = Math.floor(Math.random() * ROWS_PER_IMAGE);
    if (!confirmedIndices[idx]) {
      confirmedIndices[idx] = true;
      confirmCount++;
    }
  }

  for (var k = 0; k < ROWS_PER_IMAGE; k++) {
    var reaction = generateReaction(pool[k], isBoosted && pool[k] === 'happy');
    var confirmed = confirmedIndices[k] ? true : false;
    // Spread created_at over the past 7 days for realism
    var daysAgo = randomFloat(0.5, 7);
    var createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    rows.push({
      content_id: contentId,
      session_id: generateSessionId(),
      happy: reaction.happy,
      sad: reaction.sad,
      angry: reaction.angry,
      disgusted: reaction.disgusted,
      fearful: reaction.fearful,
      surprised: reaction.surprised,
      dominant_emotion: reaction.dominant_emotion,
      user_confirmed: confirmed,
      is_synthetic: true,
      created_at: createdAt
    });
  }

  return rows;
}

function rowToSQL(row) {
  return "  ('" +
    row.content_id.replace(/'/g, "''") + "', '" +
    row.session_id + "', " +
    row.happy.toFixed(6) + ', ' +
    row.sad.toFixed(6) + ', ' +
    row.angry.toFixed(6) + ', ' +
    row.disgusted.toFixed(6) + ', ' +
    row.fearful.toFixed(6) + ', ' +
    row.surprised.toFixed(6) + ", '" +
    row.dominant_emotion + "', " +
    row.user_confirmed + ', ' +
    row.is_synthetic + ", '" +
    row.created_at + "')";
}

// --- Main ---

var manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
var allRows = [];

manifest.items.forEach(function(item) {
  var isBoosted = BOOSTED_IDS.indexOf(item.id) !== -1;
  var rows = generateRowsForContent(item.id, isBoosted);
  allRows = allRows.concat(rows);
});

// Build SQL
var lines = [];
lines.push('-- Synthetic reaction data for ERNEST');
lines.push('-- Generated: ' + new Date().toISOString());
lines.push('-- Total rows: ' + allRows.length + ' (' + ROWS_PER_IMAGE + ' per image, ' + manifest.items.length + ' images)');
lines.push('--');
lines.push('-- STEP 1: Add is_synthetic column (safe to run if column already exists)');
lines.push("ALTER TABLE reactions ADD COLUMN IF NOT EXISTS is_synthetic boolean DEFAULT false;");
lines.push('');
lines.push('-- STEP 2: Insert synthetic data');
lines.push('INSERT INTO reactions (content_id, session_id, happy, sad, angry, disgusted, fearful, surprised, dominant_emotion, user_confirmed, is_synthetic, created_at) VALUES');

var valueLines = allRows.map(rowToSQL);
lines.push(valueLines.join(',\n') + ';');

lines.push('');
lines.push('-- Verify: count by content_id');
lines.push('-- SELECT content_id, COUNT(*) FROM reactions WHERE is_synthetic = true GROUP BY content_id ORDER BY content_id;');

fs.writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n');

console.log('Generated ' + allRows.length + ' synthetic rows for ' + manifest.items.length + ' content items');
console.log('Boosted content: ' + BOOSTED_IDS.join(', '));
console.log('Output: ' + OUTPUT_PATH);
console.log('');
console.log('To load into Supabase:');
console.log('  1. Open Supabase SQL Editor');
console.log('  2. Paste contents of ' + path.basename(OUTPUT_PATH));
console.log('  3. Run');
console.log('');
console.log('To purge synthetic data later:');
console.log('  DELETE FROM reactions WHERE is_synthetic = true;');
