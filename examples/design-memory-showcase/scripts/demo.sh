#!/usr/bin/env bash
# Design Memory showcase: runs the real engine against a throwaway git repo.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
DM_BIN="node $REPO_ROOT/dist/cli/index.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[demo] Preparing showcase repo in $TMP"
mkdir -p "$TMP/src/components" "$TMP/src/styles"
cp "$ROOT/DESIGN.md" "$ROOT/design-memory.config.json" "$TMP/"
cp "$ROOT/src/components/Button.tsx" "$TMP/src/components/"
cp "$ROOT/src/styles/theme.css" "$TMP/src/styles/"

cd "$TMP"
git init -q
git config user.email demo@design-memory.dev
git config user.name "Design Memory Demo"
git add .
git commit -qm "baseline: token-correct Button"

echo "[demo] Syncing design reference..."
$DM_BIN sync-reference --cwd "$TMP" > /dev/null
echo "[demo] Reference synced."
echo

echo "=== RUN 1: new token-correct component (expect no findings) ==="
cp "$ROOT/src/components/Input.tsx" "$TMP/src/components/"
git add .
$DM_BIN audit --cwd "$TMP"
echo "[demo] Run 1 exit code: $? (0 = clean pass)"
echo

echo "=== RUN 2: introduce drift (expect findings + blocked commit) ==="
cp "$ROOT/drift/Button.drift.tsx" "$TMP/src/components/Button.tsx"
git add .
$DM_BIN audit --cwd "$TMP"
echo "[demo] Run 2 exit code: $? (1 = commit blocked)"
echo

echo "=== RUN 3: theme-backed arbitrary values (expect no findings) ==="
cp "$ROOT/drift/Button.backed.tsx" "$TMP/src/components/Button.tsx"
git add .
$DM_BIN audit --cwd "$TMP"
echo "[demo] Run 3 exit code: $? (0 = theme tokens accepted)"
echo
echo "[demo] Done. See examples/design-memory-showcase/README.md for the full story."
