#!/bin/bash
# Netlify build script: injects environment variables into JS files
# Environment variables are set in the Netlify dashboard (Site settings > Environment variables)

set -e

if [ -z "$SUPABASE_URL" ]; then
  echo "WARNING: SUPABASE_URL not set — Supabase features will be disabled"
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "WARNING: SUPABASE_ANON_KEY not set — Supabase reads will be disabled"
fi

# Replace placeholders in variables.js
sed -i "s|%%SUPABASE_URL%%|${SUPABASE_URL:-}|g" js/variables.js
sed -i "s|%%SUPABASE_ANON_KEY%%|${SUPABASE_ANON_KEY:-}|g" js/variables.js

echo "Build complete — environment variables injected"
