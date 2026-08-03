import type { ReferenceToken } from '../types';

/**
 * Normalize a value for fuzzy comparison: strip units, hex markers, quotes.
 * `#2563eb` and `2563eb` and `var(--color-primary)` all compare on substance.
 */
export function normalizeValue(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/var\(--([a-z0-9-]+)\)/g, '$1')
    .replace(/[#pxrem'"\s]/g, '');
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(normalized)) {
    return [
      parseInt(normalized[0] + normalized[0], 16),
      parseInt(normalized[1] + normalized[1], 16),
      parseInt(normalized[2] + normalized[2], 16),
    ];
  }
  if (/^[0-9a-f]{6}$/.test(normalized)) {
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  }
  return null;
}

/**
 * Find the reference token closest to a found value: exact value match wins,
 * then numeric proximity (same family of sizes), then hex channel distance,
 * then kebab-name prefix overlap. Returns null when nothing is close enough
 * so the audit never guesses wildly.
 */
export function findClosestToken(tokens: ReferenceToken[], found: string): ReferenceToken | null {
  const target = normalizeValue(found);
  if (!target) {
    return null;
  }

  let best: ReferenceToken | null = null;
  let bestScore = 0;

  const targetNum = target.match(/^(\d+(?:\.\d+)?)/);
  const targetRgb = hexToRgb(found);

  for (const token of tokens) {
    const candidates = [token.value, ...(token.aliases ?? []), ...(token.codeHints ?? [])];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const normalized = normalizeValue(candidate);
      if (!normalized) {
        continue;
      }

      let score = 0;
      if (normalized === target) {
        return token;
      }

      const candNum = normalized.match(/^(\d+(?:\.\d+)?)/);
      if (targetNum && candNum) {
        const a = Number(targetNum[1]);
        const b = Number(candNum[1]);
        score = 1 - Math.abs(a - b) / Math.max(a, b, 1);
      }

      if (targetRgb) {
        const candRgb = hexToRgb(candidate);
        if (candRgb) {
          const distance =
            Math.abs(targetRgb[0] - candRgb[0]) +
            Math.abs(targetRgb[1] - candRgb[1]) +
            Math.abs(targetRgb[2] - candRgb[2]);
          score = Math.max(score, 1 - distance / 765);
        }
      }

      if (score === 0 && (normalized.startsWith(target) || target.startsWith(normalized))) {
        score = Math.min(normalized.length, target.length) / Math.max(normalized.length, target.length);
      }

      if (score > bestScore) {
        bestScore = score;
        best = token;
      }
    }
  }

  return bestScore >= 0.55 ? best : null;
}

export function replacementSuggestion(token: ReferenceToken | null, foundClass: string): string {
  if (!token) {
    return `Replace ${foundClass} with an approved design token or token-backed class.`;
  }
  const className = token.codeHints?.[0] ?? token.name;
  return `Replace ${foundClass} with ${className} (token ${token.name})`;
}
