#!/usr/bin/env node

// Scans content/ directory and generates content-manifest.json
// Usage: node scripts/generate-manifest.js

var fs = require('fs');
var path = require('path');

var CONTENT_DIR = path.join(__dirname, '..', 'content');
var MANIFEST_PATH = path.join(__dirname, '..', 'content-manifest.json');
var SUPPORTED_EXTENSIONS = ['.gif', '.jpg', '.jpeg', '.png', '.webp'];

// Load existing manifest to preserve added dates
var existingItems = {};
if (fs.existsSync(MANIFEST_PATH)) {
  try {
    var existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    existing.items.forEach(function(item) {
      existingItems[item.id] = item;
    });
  } catch (e) {
    console.warn('Could not parse existing manifest, starting fresh');
  }
}

// Scan content directory
var files = fs.readdirSync(CONTENT_DIR).filter(function(file) {
  var ext = path.extname(file).toLowerCase();
  return SUPPORTED_EXTENSIONS.indexOf(ext) !== -1;
}).sort();

var today = new Date().toISOString().split('T')[0];
var added = 0;
var kept = 0;
var removed = Object.keys(existingItems).length;

var items = files.map(function(filename) {
  var ext = path.extname(filename).toLowerCase();
  var id = path.basename(filename, path.extname(filename)).toLowerCase();
  var type = ext === '.gif' ? 'gif' : 'image';

  if (existingItems[id]) {
    kept++;
    removed--;
    return {
      id: id,
      filename: filename,
      type: type,
      added: existingItems[id].added,
      tags: existingItems[id].tags || []
    };
  } else {
    added++;
    return {
      id: id,
      filename: filename,
      type: type,
      added: today,
      tags: []
    };
  }
});

var manifest = {
  version: 1,
  generated: new Date().toISOString(),
  items: items
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log('Manifest generated: ' + items.length + ' items');
console.log('  Added: ' + added);
console.log('  Kept: ' + kept);
console.log('  Removed: ' + removed);
