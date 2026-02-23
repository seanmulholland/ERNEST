#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Start a Python HTTP server for the static site preview
# All JS dependencies are vendored — no install step needed
PORT=8000
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Kill any existing server on the port
fuser -k "${PORT}/tcp" 2>/dev/null || true

cd "$PROJECT_DIR"
python3 -m http.server "$PORT" > /tmp/ernest-server.log 2>&1 &

echo "ERNEST preview server started at http://localhost:${PORT}"
