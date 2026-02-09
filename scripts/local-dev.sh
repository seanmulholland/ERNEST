#!/bin/bash
# Local development: injects .env.local values into variables.js and starts a server
# Usage: bash scripts/local-dev.sh
# To revert: git checkout js/variables.js

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local not found. Copy from template:"
  echo "  SUPABASE_URL=https://yourproject.supabase.co"
  echo "  SUPABASE_PUBLISHABLE_KEY=sb_publishable_..."
  exit 1
fi

# Source env vars
export $(grep -v '^#' "$ENV_FILE" | xargs)

if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://YOUR_PROJECT_REF.supabase.co" ]; then
  echo "ERROR: Set your real SUPABASE_URL in .env.local"
  exit 1
fi

# Replace placeholders in variables.js
sed -i.bak "s|%%SUPABASE_URL%%|${SUPABASE_URL}|g" "$PROJECT_DIR/js/variables.js"
sed -i.bak "s|%%SUPABASE_PUBLISHABLE_KEY%%|${SUPABASE_PUBLISHABLE_KEY}|g" "$PROJECT_DIR/js/variables.js"
rm -f "$PROJECT_DIR/js/variables.js.bak"

echo "Credentials injected into js/variables.js"
echo ""
echo "Starting local server at http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""
echo "REMINDER: Run 'git checkout js/variables.js' when done to restore placeholders"
echo ""

cd "$PROJECT_DIR"
python3 -m http.server 8000
