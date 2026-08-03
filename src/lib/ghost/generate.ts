import { exportDesignMarkdown } from '../design-md/export';
import type { ComponentReference, ReferenceSnapshot, ReferenceToken } from '../types';

const ENFORCEMENT_LINE = 'Violations are enforced by: design-memory audit (pre-commit, CI, and agent loop).';

export const SECTION_START = '<!-- design-memory:start -->';
export const SECTION_END = '<!-- design-memory:end -->';

function tokenLine(token: ReferenceToken): string {
  const cls = token.codeHints?.[0] ?? token.name;
  return `- ${token.name} -> \`${cls}\` -> ${token.value ?? ''}`;
}

function componentLines(component: ComponentReference): string[] {
  const lines: string[] = [`### ${component.name}`];
  if (component.variants?.length) {
    lines.push(`- Variants: ${component.variants.map((variant) => variant.name).join(', ')}`);
  }
  if (component.states?.length) {
    lines.push(`- States: ${component.states.map((state) => state.name).join(', ')}`);
  }
  for (const pattern of component.requiredPatterns ?? []) {
    lines.push(`- Required: \`${pattern}\``);
  }
  for (const pattern of component.disallowedPatterns ?? []) {
    lines.push(`- Disallowed: \`${pattern}\``);
  }
  for (const token of component.tokensUsed ?? []) {
    lines.push(`- Token: ${token}`);
  }
  return lines;
}

function rulesFile(snapshot: ReferenceSnapshot): string {
  const lines = [
    '---',
    'description: Design Memory rules — exact tokens, components, and approved classes. No invented values.',
    'globs: **/*.{ts,tsx,js,jsx,css}',
    '---',
    '',
    '# Design System Rules',
    '',
    'Use ONLY the tokens and classes below. Never invent new tokens, raw hex colors, arbitrary Tailwind values, or inline styles.',
    '',
    '## Tokens',
    '',
    ...snapshot.tokens.map(tokenLine),
    '',
  ];
  for (const component of snapshot.components) {
    lines.push('## Components', '', ...componentLines(component), '');
  }
  lines.push(ENFORCEMENT_LINE, '');
  return lines.join('\n');
}

function sectionFile(snapshot: ReferenceSnapshot, label: string): string {
  const lines = [
    `## ${label}`,
    '',
    `Tokens: ${snapshot.tokens.length} total (full list in design-tokens.md).`,
    '',
    ...snapshot.components.map((component) => {
      const variantNames = (component.variants ?? []).map((variant) => variant.name).join(', ');
      const stateNames = (component.states ?? []).map((state) => state.name).join(', ');
      const detail = [variantNames && `variants: ${variantNames}`, stateNames && `states: ${stateNames}`]
        .filter(Boolean)
        .join('; ');
      return `- ${component.name}${detail ? ` (${detail})` : ''}`;
    }),
    '',
    'Use only tokens and classes from the reference. No raw hex, no arbitrary Tailwind values, no inline styles.',
    '',
    ENFORCEMENT_LINE,
  ];
  return lines.join('\n');
}

export function designTokensMarkdown(snapshot: ReferenceSnapshot): string {
  const rows = snapshot.tokens
    .map((token) => `| ${token.name} | \`${token.codeHints?.[0] ?? token.name}\` | \`${token.value ?? ''}\` |`)
    .join('\n');
  return `# Design Tokens

| Token | Class | Value |
| --- | --- | --- |
${rows}
`;
}

export function cursorRules(snapshot: ReferenceSnapshot): string {
  const lines = [
    '# Cursor Rules',
    '',
    `Design Memory rules for this repository (${snapshot.metadata.source}).`,
    '',
    ...snapshot.tokens.map((token) => `- ${token.name}: use \`${token.codeHints?.[0] ?? token.name}\` (${token.value ?? ''})`),
    '',
    ...snapshot.components.map((component) => `- Component ${component.name}: variants ${(component.variants ?? []).map((variant) => variant.name).join(', ') || 'none'}; states ${(component.states ?? []).map((state) => state.name).join(', ') || 'none'}`),
    '',
    ENFORCEMENT_LINE,
    '',
  ];
  return lines.join('\n');
}

/**
 * Generate the agent design pack: every agent-facing artifact derived from the
 * reference snapshot. Keys are target file paths.
 */
export function generateAgentPack(snapshot: ReferenceSnapshot): Record<string, string> {
  return {
    '.cursor/rules/design.mdc': rulesFile(snapshot),
    '.cursorrules': cursorRules(snapshot),
    'CLAUDE.md': sectionFile(snapshot, 'Design'),
    'AGENTS.md': sectionFile(snapshot, 'Design'),
    '.github/copilot-instructions.md': sectionFile(snapshot, 'Design'),
    '.clinerules': sectionFile(snapshot, 'Design'),
    'DESIGN.md': exportDesignMarkdown(snapshot),
    'design-tokens.md': designTokensMarkdown(snapshot),
  };
}
