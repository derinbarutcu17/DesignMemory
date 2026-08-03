import fs from 'node:fs';
import path from 'node:path';

export type ThemeTokens = {
  colors: Map<string, string>;
  namespaces: Map<string, Set<string>>;
  varNames: Set<string>;
};

const SKIP_DIRS = new Set(['node_modules', '.git', '.design-memory', 'dist', 'build', '.next', 'coverage', 'out', 'public']);

// ponytail: flat walk, fine for repo-sized trees; add gitignore-aware walk if audits get slow on monorepos
function walkCssFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walkCssFiles(fullPath, out);
      }
    } else if (entry.name.endsWith('.css')) {
      out.push(fullPath);
    }
  }
  return out;
}

// ponytail: no nested-brace handling, @theme blocks do not nest in practice
const THEME_BLOCK_RE = /@theme\s*\{([^}]*)\}/g;
const TOKEN_RE = /--([a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g;

/**
 * Load Tailwind v4 @theme tokens from the target repo's CSS files.
 * Tokens are grouped by namespace (color, spacing, radius, text, ...) so an
 * arbitrary value is only considered theme-backed by tokens of its own family.
 */
export function loadThemeTokens(cwd: string): ThemeTokens {
  const tokens: ThemeTokens = { colors: new Map(), namespaces: new Map(), varNames: new Set() };

  for (const cssFile of walkCssFiles(cwd)) {
    const content = fs.readFileSync(cssFile, 'utf-8');
    for (const block of content.match(THEME_BLOCK_RE) ?? []) {
      for (const match of block.matchAll(TOKEN_RE)) {
        const name = match[1].trim().toLowerCase();
        const value = match[2].trim().toLowerCase();
        const dashIndex = name.indexOf('-');
        const namespace = dashIndex === -1 ? name : name.slice(0, dashIndex);

        tokens.varNames.add(`--${name}`);
        if (!tokens.namespaces.has(namespace)) {
          tokens.namespaces.set(namespace, new Set());
        }
        tokens.namespaces.get(namespace)!.add(value);
        if (namespace === 'color') {
          tokens.colors.set(name, value);
        }
      }
    }
  }

  return tokens;
}

/**
 * True when a raw value (e.g. "14px") is defined by a token of the given
 * namespace, or the value is a var() reference to any theme token
 * (e.g. "--spacing-4", "var(--spacing-4)").
 */
export function isThemeBacked(tokens: ThemeTokens, namespace: string, rawValue: string): boolean {
  const value = rawValue.trim().toLowerCase();
  if (!value) {
    return false;
  }
  const varRef = value.match(/^(?:var\()?--([a-zA-Z0-9-]+)\)?$/);
  if (varRef) {
    return tokens.varNames.has(`--${varRef[1]}`);
  }
  return tokens.namespaces.get(namespace)?.has(value) ?? false;
}
