import type { ReferenceToken } from '../types';
import { toKebabCase } from '../utils';

export type ParseDtcgOptions = {
  fileName?: string;
};

type DtcgLeaf = {
  $value?: unknown;
  $type?: string;
  $description?: string;
};

type DtcgGroup = {
  [key: string]: unknown;
};

const TOKEN_KINDS = new Set([
  'color',
  'dimension',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'borderRadius',
  'spacing',
  'number',
  'string',
  'typography',
  'shadow',
  'gradient',
  'duration',
]);

const CODE_HINT_KINDS: Record<string, (name: string) => string[]> = {
  color: (name) => [`bg-${name}`, `text-${name}`, `border-${name}`],
  spacing: (name) => [`p-${name}`, `m-${name}`, `gap-${name}`],
  borderRadius: (name) => [`rounded-${name}`],
  fontSize: (name) => [`text-${name}`],
};

export function codeHintsFor(kind: string, dotName: string): string[] | undefined {
  const factory = CODE_HINT_KINDS[kind];
  return factory ? factory(hintNameFor(dotName.split('.'))) : undefined;
}

function isDtcgLeaf(value: unknown): value is DtcgLeaf {
  return typeof value === 'object' && value !== null && '$value' in (value as Record<string, unknown>);
}

function refName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.match(/^\{(.+)\}$/);
  return match ? match[1] : null;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function hintNameFor(fullPath: string[]): string {
  return toKebabCase(fullPath.slice(1).join('-'));
}

/**
 * Parse a W3C DTCG Design Tokens JSON file (the format Tokens Studio and
 * Figma variable exports commit to git) into ReferenceTokens.
 *
 * Nested groups flatten to dot paths (`color.primary`), `$value` becomes the
 * token value, and `{ref}` references become alias relationships. Malformed
 * groups throw with the file name and offending group path.
 */
export function parseDtcgTokens(json: unknown, options: ParseDtcgOptions = {}): ReferenceToken[] {
  const fileName = options.fileName ?? 'tokens.json';
  const tokens: ReferenceToken[] = [];
  const aliasMap = new Map<string, string[]>();

  function walk(group: DtcgGroup, groupPath: string[]): void {
    for (const [key, rawValue] of Object.entries(group)) {
      if (typeof rawValue !== 'object' || rawValue === null) {
        throw new Error(
          `Invalid DTCG token file ${fileName}: expected an object at ${[...groupPath, key].join('.') || '<root>'}`,
        );
      }

      if (isDtcgLeaf(rawValue)) {
        const type = typeof rawValue.$type === 'string' ? rawValue.$type : undefined;
        const fullPath = [...groupPath, key];
        const kind = fullPath[0];

        if (type && !TOKEN_KINDS.has(type)) {
          throw new Error(
            `Invalid DTCG token file ${fileName}: unsupported $type "${type}" at ${fullPath.join('.')}`,
          );
        }

        const token: ReferenceToken = {
          name: fullPath.join('.'),
          kind: type ?? kind,
          value: stringifyValue(rawValue.$value),
          sourceType: 'dtcg',
        };

        const ref = refName(rawValue.$value);
        if (ref) {
          token.aliases = [ref];
          token.value = ref;
          aliasMap.set(token.name, [ref]);
        }

        if (token.kind && CODE_HINT_KINDS[token.kind]) {
          token.codeHints = codeHintsFor(token.kind, token.name);
        }

        tokens.push(token);
        continue;
      }

      walk(rawValue as DtcgGroup, [...groupPath, key]);
    }
  }

  walk(json as DtcgGroup, []);
  if (tokens.length === 0) {
    throw new Error(`Invalid DTCG token file ${fileName}: no tokens found at the root level.`);
  }

  return tokens;
}

export function aliasMapFromDtcg(tokens: ReferenceToken[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const token of tokens) {
    if (token.aliases?.length) {
      map[token.name] = [...token.aliases];
    }
  }
  return map;
}
