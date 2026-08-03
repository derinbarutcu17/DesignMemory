import type { ComponentReference, ReferenceSnapshot, ReferenceToken } from '../types';

const TOKEN_SECTION_BY_KIND: Record<string, string> = {
  color: 'Color Palette & Roles',
  spacing: 'Spacing',
  borderRadius: 'Shape & Radius',
  fontSize: 'Typography Rules',
};

function primaryClass(token: ReferenceToken): string {
  return token.codeHints?.[0] ?? token.name;
}

function tokenTable(tokens: ReferenceToken[]): string {
  const rows = tokens
    .map((token) => `| ${token.name} | \`${primaryClass(token)}\` | \`${token.value ?? ''}\` |`)
    .join('\n');
  return `| Token | Class | Value |
| --- | --- | --- |
${rows}`;
}

function cleanSummary(summary: string): string {
  return summary.split(/(?:Must use|Disallowed|States?|Variants?)\s*:/i)[0].trim();
}

function componentSection(component: ComponentReference): string {
  const lines: string[] = [`### ${component.name}`, ''];
  const summary = component.summary ? cleanSummary(component.summary) : '';
  if (summary) {
    lines.push(summary, '');
  }
  if (component.requiredPatterns?.length) {
    lines.push(`Must use: ${component.requiredPatterns.map((pattern) => `\`${pattern}\``).join(', ')}`, '');
  }
  if (component.disallowedPatterns?.length) {
    lines.push(`Disallowed: ${component.disallowedPatterns.map((pattern) => `\`${pattern}\``).join(', ')}`, '');
  }
  if (component.states?.length) {
    lines.push(`States: ${component.states.map((state) => state.name).join(', ')}`, '');
  }
  if (component.variants?.length) {
    lines.push(`Variants: ${component.variants.map((variant) => variant.name).join(', ')}`, '');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Export a reference snapshot as a spec-aligned DESIGN.md (Google Stitch
 * structure with Design Memory contract lines), such that
 * `sync-reference` -> `ghost --format design-md` -> re-sync round-trips.
 */
export function exportDesignMarkdown(snapshot: ReferenceSnapshot): string {
  const title = snapshot.metadata.versionLabel?.replace(/\.md$/i, '') || 'Design System';
  const sections: string[] = [`# Design System: ${title}`, ''];

  const byKind = new Map<string, ReferenceToken[]>();
  for (const token of snapshot.tokens) {
    const kind = token.kind ?? 'tokens';
    if (!byKind.has(kind)) {
      byKind.set(kind, []);
    }
    byKind.get(kind)!.push(token);
  }

  let index = 1;
  for (const [kind, tokens] of byKind) {
    const heading = TOKEN_SECTION_BY_KIND[kind] ?? 'Tokens';
    sections.push(`## ${index}. ${heading}`, '', tokenTable(tokens), '');
    index += 1;
  }

  if (snapshot.components.length > 0) {
    sections.push(`## ${index}. Components`, '');
    for (const component of snapshot.components) {
      sections.push(componentSection(component), '');
    }
  }

  return `${sections.join('\n').trim()}\n`;
}
