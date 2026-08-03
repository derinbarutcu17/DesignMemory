#!/usr/bin/env bash
# Design Memory showcase v2: the 6-act adoption story against the real engine.
# Act 1 sync -> Act 2 baseline -> Act 3 clean pass -> Act 4 drift blocked ->
# Act 5 theme-backed pass -> Act 6 review memory. Runs against dist/ (the
# real build), in a throwaway git repo.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
DM="node $REPO_ROOT/dist/cli/index.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -f "$REPO_ROOT/dist/cli/index.js" ]; then
  echo "[demo] Building the engine first (dist/ missing)..."
  (cd "$REPO_ROOT" && npm run build > /dev/null)
fi

echo "[demo] Preparing showcase repo in $TMP"
mkdir -p "$TMP/src/components" "$TMP/src/styles"
cp "$ROOT/tokens.json" "$ROOT/DESIGN.md" "$ROOT/design-memory.config.json" "$TMP/"
cp "$ROOT/src/styles/theme.css" "$TMP/src/styles/"

cd "$TMP"
git init -q
git config user.email demo@design-memory.dev
git config user.name "Design Memory Demo"
git add .
git commit -qm "base: design truth (tokens, DESIGN.md, theme)"

echo
echo "=========== ACT 1: sync the design truth ==========="
$DM sync-reference --cwd "$TMP"
echo

echo "=========== ACT 2: baseline the brownfield ==========="
# Brownfield state: components that already drifted. Staged now so the first
# audit accepts them as the baseline; only net-new drift blocks from here on.
cp "$ROOT/drift/Button.drift.tsx" "$TMP/src/components/Button.tsx"
cp "$ROOT/drift/Card.drift-pattern.tsx" "$TMP/src/components/Card.tsx"
cp "$ROOT/drift/Badge.drift-legacy.tsx" "$TMP/src/components/Badge.tsx"
git add .
$DM audit --cwd "$TMP" --create-baseline 2>&1 | tail -2
echo

echo "=========== ACT 3: new token-correct component ==========="
cp "$ROOT/src/components/Input.tsx" "$TMP/src/components/Input.tsx"
git add .
$DM audit --cwd "$TMP" > /dev/null 2>&1
CLEAN_EXIT=$?
echo "[demo] audit exit code: $CLEAN_EXIT (0 = nothing new to block; the 19 baselined findings are not reported)"
echo

echo "=========== ACT 4: agent drift introduced, gate blocks it ==========="
cat > "$TMP/src/components/Input.tsx" <<'EOF'
export function Input({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-text">{label}</span>
      <input className="mt-1 w-full bg-[#2562eb] p-[9px] rounded-lg border" />
    </label>
  );
}
EOF
git add .
$DM audit --cwd "$TMP" > /dev/null 2>&1
BLOCKED=$?
echo "[demo] audit exit code: $BLOCKED (1 = blocked, net-new drift only)"
$DM audit --cwd "$TMP" --json 2>/dev/null | node -e "
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  const run = JSON.parse(d);
  const blocking = run.issues.filter((i) => i.status === 'new' || i.status === 'reopened');
  for (const issue of blocking) {
    console.log('  [' + issue.severity + '] ' + issue.ruleId + ' at ' + issue.filePath + ':' + issue.line + ':' + issue.column);
    console.log('        ' + issue.suggestedAction);
  }
});"
echo

echo "=========== ACT 5: theme-backed arbitrary values pass ==========="
cat > "$TMP/src/components/Input.tsx" <<'EOF'
export function Input({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-text">{label}</span>
      <input className="mt-1 w-full bg-surface rounded-lg border px-3 pt-[16px] text-[14px] focus:border-primary disabled:opacity-50" />
    </label>
  );
}
EOF
git add .
$DM audit --cwd "$TMP" > /dev/null 2>&1
BACKED_EXIT=$?
echo "[demo] audit exit code: $BACKED_EXIT (0 = theme-backed arbitrary values accepted)"
echo

echo "=========== ACT 6: review as intentional, memory stops the block ==========="
cat > "$TMP/src/components/Input.tsx" <<'EOF'
export function Input({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-text">{label}</span>
      <input className="mt-1 w-full bg-primary p-[9px] rounded-lg border" />
    </label>
  );
}
EOF
git add .
FP=$($DM audit --cwd "$TMP" --json 2>/dev/null | node -e "let d='';process.stdin.on('data',(c)=>(d+=c));process.stdin.on('end',()=>{const r=JSON.parse(d);console.log(r.issues.find((i)=>i.ruleId==='tailwind.arbitrary-spacing').fingerprint)})")
echo "[demo] drift fingerprint: $FP"
$DM review --cwd "$TMP" --fingerprint "$FP" --status intentional --note "demo: deliberate 9px inset" > /dev/null
$DM audit --cwd "$TMP" > /dev/null 2>&1
MEMORY_EXIT=$?
echo "[demo] audit after review: exit $MEMORY_EXIT (0 = no longer blocking)"
$DM review --cwd "$TMP" --export
echo
echo "[demo] Done. The full arc: sync -> baseline -> clean -> blocked -> theme-backed -> remembered."
