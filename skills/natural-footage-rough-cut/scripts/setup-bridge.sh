#!/usr/bin/env bash
# One-time setup for `--to resolve` (live append into DaVinci Resolve).
# Clones the davinci-resolve-mcp bridge into this skill's vendor/ folder.
# Not needed for --to xml (File → Import Timeline works with zero setup).
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="${RESOLVE_BRIDGE_VENDOR:-$SKILL_DIR/vendor/davinci-resolve-mcp}"
REPO="https://github.com/samuelgursky/davinci-resolve-mcp.git"

if [ -d "$VENDOR/src" ]; then
  echo "✓ bridge already present: $VENDOR"
else
  mkdir -p "$(dirname "$VENDOR")"
  echo "cloning $REPO → $VENDOR"
  git clone --depth 1 "$REPO" "$VENDOR"
  echo "✓ bridge installed: $VENDOR"
fi

cat <<'EOF'

Resolve-side setup (each Resolve session that uses --to resolve):
  1. Open your project in DaVinci Resolve.
  2. Workspace → Scripts → resolve_bridge   (starts the in-app bridge)
  3. Set the project/timeline frame rate by hand (Resolve can't script it).
Then run the cut with --to resolve. Don't click around in Resolve while it
writes. Override the checkout location any time with RESOLVE_BRIDGE_VENDOR.
EOF
