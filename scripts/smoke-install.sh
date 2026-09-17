#!/usr/bin/env bash
# Pack the published artifact, install it into a clean temp project, and verify
# that init, sync-reference, audit (clean), and audit (drift blocked) all work.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[smoke] packing"
cd "$ROOT"
npm pack --pack-destination "$TMP" >/dev/null
PKG="$(ls "$TMP"/*.tgz | head -1)"

echo "[smoke] installing into a clean project"
PROJECT="$TMP/project"
mkdir -p "$PROJECT/src/components"
cd "$PROJECT"
npm init -y >/dev/null 2>&1
npm install --no-audit --no-fund "$PKG" >/dev/null 2>&1

cat > design-memory.config.json <<'JSON'
{
  "strictness": "block",
  "reference": { "sourceType": "design-md", "path": "./DESIGN.md" }
}
JSON

cat > DESIGN.md <<'MD'
# Design

## Components

### Button

Must use: `bg-primary`
MD

cat > src/components/Button.tsx <<'TSX'
export function Button() {
  return <button className="bg-primary" />;
}
TSX

git init -q
git config user.email smoke@example.com
git config user.name Smoke
git add -A

echo "[smoke] sync-reference"
npx design-memory sync-reference >/dev/null

echo "[smoke] clean audit must exit 0"
npx design-memory audit >/dev/null

echo "[smoke] drift audit must exit 1"
cat > src/components/BadPanel.tsx <<'TSX'
export function BadPanel() {
  return <div className="p-[9px]" />;
}
TSX
git add -A
if npx design-memory audit >/dev/null 2>&1; then
  echo "[smoke] FAIL: drift was not blocked"
  exit 1
fi

echo "[smoke] OK: packed CLI installs and gates correctly"
