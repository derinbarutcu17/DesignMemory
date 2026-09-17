#!/usr/bin/env bash
# Run the same audit twice against the same staged change and require the
# deterministic content of both runs to be byte-identical. Historical deltas
# (run id, timestamps, comparison against the previous run) are excluded by
# definition: they describe different input states across the two runs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/dist/cli/index.js" ]]; then
  echo "[determinism] dist/cli/index.js missing, run npm run build first"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

APP="$TMP/app"
mkdir -p "$APP"
(cd "$ROOT/apps/procure-dash" && tar cf - --exclude node_modules --exclude dist --exclude .git .) | (cd "$APP" && tar xf -)

cd "$APP"
git init -q
git config user.email determinism@example.com
git config user.name Determinism
git add -A
git commit -qm base

printf '\n// determinism probe\n' >> src/ui/Card.tsx
git add -A

node "$ROOT/dist/cli/index.js" audit --json --cwd "$APP" > "$TMP/run1.json" 2>/dev/null
node "$ROOT/dist/cli/index.js" audit --json --cwd "$APP" > "$TMP/run2.json" 2>/dev/null

node - "$TMP/run1.json" "$TMP/norm1.json" "$TMP/run2.json" "$TMP/norm2.json" <<'NODE'
const fs = require('node:fs');
const [leftFile, leftOut, rightFile, rightOut] = process.argv.slice(2);

function normalize(file, out) {
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete run.id;
  delete run.createdAt;
  delete run.comparison;
  if (run.summary) {
    delete run.summary.resolvedCount;
    delete run.summary.remainingCount;
  }
  const text = JSON.stringify(run, null, 2);
  fs.writeFileSync(out, text);
  return text;
}

const left = normalize(leftFile, leftOut);
const right = normalize(rightFile, rightOut);
if (left !== right) {
  process.exit(1);
}
NODE

if ! cmp -s "$TMP/norm1.json" "$TMP/norm2.json"; then
  echo "[determinism] FAIL: two runs of the same change differ"
  diff -u "$TMP/norm1.json" "$TMP/norm2.json" | head -40
  exit 1
fi

echo "[determinism] OK: two runs are byte-identical"
