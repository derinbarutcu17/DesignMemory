import { extractStyleUsages, scriptKindForFile } from '../ast';
import type { DesignMemoryConfig } from '../config';
import { isThemeBacked, loadThemeTokens, type ThemeTokens } from '../theme';
import { findClosestToken, replacementSuggestion } from '../tokens/closest';
import type { DriftIssue, ReferenceSnapshot } from '../types';
import { normalizeForMatch, toPascalCase } from '../utils';
import {
  buildTokenMatchers,
  createIssue,
  evidenceExcerpt,
  getFileStem,
  pushIssue,
  type FileDiff,
  type FileIssueContext,
  type Mapping,
  type TokenMatcher,
} from './shared';

export function detectStyleRuleIssues(
  issues: DriftIssue[],
  config: DesignMemoryConfig,
  ctx: FileIssueContext,
  allowedHexes: Set<string>,
  theme: ThemeTokens,
  snapshot: ReferenceSnapshot,
) {
  // With real hunks, only report drift on lines added by this diff (net-new semantics).
  // Test harness diffs carry no hunk headers, so fall back to reporting everything.
  const isChangedLine = ctx.file.hasHunks
    ? (line: number) => ctx.file.addedLineNumbers.has(line)
    : () => true;

  for (const classToken of ctx.styleUsages.classTokens) {
    if (!isChangedLine(classToken.line)) {
      continue;
    }

    // Strip variant prefixes (hover:bg-primary -> bg-primary) before matching.
    const segments = classToken.value.split(':');
    const cls = segments[segments.length - 1];

    const hexMatch = cls.match(/^[a-z-]+-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (hexMatch) {
      const hex = hexMatch[1].toLowerCase();
      if (!allowedHexes.has(hex)) {
        const closest = findClosestToken(snapshot.tokens.filter((token) => token.kind === 'color'), hex);
        pushIssue(issues, createIssue(config, {
          ruleId: 'color.raw-hex',
          componentName: ctx.defaultComponentName,
          filePath: ctx.file.filePath,
          expected: 'Use approved color tokens from the reference snapshot.',
          found: cls,
          evidenceSnippet: cls,
          suggestedAction: replacementSuggestion(closest, cls),
          line: classToken.line,
          column: classToken.column,
        }));
      }
      continue;
    }

    const spacingMatch = cls.match(/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap)-\[([^\]]+)\]$/);
    if (spacingMatch && !isThemeBacked(theme, 'spacing', spacingMatch[2])) {
      const closest = findClosestToken(snapshot.tokens.filter((token) => token.kind === 'spacing'), spacingMatch[2]);
      pushIssue(issues, createIssue(config, {
        ruleId: 'tailwind.arbitrary-spacing',
        componentName: ctx.defaultComponentName,
        filePath: ctx.file.filePath,
        expected: 'Use token-backed spacing classes instead of arbitrary spacing values.',
        found: cls,
        evidenceSnippet: cls,
        suggestedAction: replacementSuggestion(closest, cls),
        line: classToken.line,
        column: classToken.column,
      }));
      continue;
    }

    const radiusMatch = cls.match(/^rounded(?:-[trbl]{1,2})?-\[([^\]]+)\]$/);
    if (radiusMatch && !isThemeBacked(theme, 'radius', radiusMatch[1])) {
      const closest = findClosestToken(snapshot.tokens.filter((token) => token.kind === 'borderRadius'), radiusMatch[1]);
      pushIssue(issues, createIssue(config, {
        ruleId: 'tailwind.arbitrary-radius',
        componentName: ctx.defaultComponentName,
        filePath: ctx.file.filePath,
        expected: 'Use approved radius classes instead of arbitrary radius values.',
        found: cls,
        evidenceSnippet: cls,
        suggestedAction: replacementSuggestion(closest, cls),
        line: classToken.line,
        column: classToken.column,
      }));
      continue;
    }

    const fontSizeMatch = cls.match(/^text-\[([^\]]+)\]$/);
    if (fontSizeMatch && !isThemeBacked(theme, 'text', fontSizeMatch[1])) {
      const closest = findClosestToken(snapshot.tokens.filter((token) => token.kind === 'fontSize'), fontSizeMatch[1]);
      pushIssue(issues, createIssue(config, {
        ruleId: 'tailwind.arbitrary-font-size',
        componentName: ctx.defaultComponentName,
        filePath: ctx.file.filePath,
        expected: 'Use approved typography scale classes instead of arbitrary font-size values.',
        found: cls,
        evidenceSnippet: cls,
        suggestedAction: replacementSuggestion(closest, cls),
        line: classToken.line,
        column: classToken.column,
      }));
    }
  }

  for (const prop of ctx.styleUsages.styleProps) {
    if (!isChangedLine(prop.line)) {
      continue;
    }
    const hexes = Array.from(new Set(prop.value.match(/#(?:[0-9a-fA-F]{3,8})\b/g) ?? []));
    for (const hex of hexes) {
      if (!allowedHexes.has(hex.toLowerCase())) {
        const closest = findClosestToken(snapshot.tokens.filter((token) => token.kind === 'color'), hex);
        pushIssue(issues, createIssue(config, {
          ruleId: 'color.raw-hex',
          componentName: ctx.defaultComponentName,
          filePath: ctx.file.filePath,
          expected: 'Use approved color tokens from the reference snapshot.',
          found: hex,
          evidenceSnippet: `${prop.key}: ${prop.value}`,
          suggestedAction: replacementSuggestion(closest, hex),
          line: prop.line,
          column: prop.column,
        }));
      }
    }
  }

  if (ctx.styleUsages.inlineStyleCount > 0 && isChangedLine(ctx.styleUsages.styleProps[0]?.line ?? 0)) {
    pushIssue(issues, createIssue(config, {
      ruleId: 'style.inline',
      componentName: ctx.defaultComponentName,
      filePath: ctx.file.filePath,
      expected: 'Avoid inline styles in audited UI files.',
      found: 'style={{ ... }}',
      evidenceSnippet: 'style={{ ... }}',
      suggestedAction: 'Move the inline style into approved Tailwind utilities or token-backed classes.',
      line: ctx.styleUsages.styleProps[0]?.line,
      column: ctx.styleUsages.styleProps[0]?.column,
    }));
  }
}

export function detectComponentContractIssues(
  issues: DriftIssue[],
  snapshot: ReferenceSnapshot,
  config: DesignMemoryConfig,
  mappings: Mapping[],
  ctx: FileIssueContext,
) {
  for (const mapping of mappings) {
    // Content-only matches (confidence < 0.86) mean the file merely references
    // the component, for example an import in a consumer page. Contract rules
    // apply to the component's own file, not to its call sites.
    if (mapping.confidence < 0.86) {
      continue;
    }
    const component = snapshot.components[mapping.referenceIndex];

    for (const pattern of component.disallowedPatterns ?? []) {
      if (ctx.rawText.includes(pattern)) {
        pushIssue(issues, createIssue(config, {
          ruleId: 'component.disallowed-pattern',
          componentName: component.name,
          filePath: ctx.file.filePath,
          expected: `Avoid disallowed pattern ${pattern} for ${component.name}.`,
          found: pattern,
          evidenceSnippet: evidenceExcerpt(ctx.rawText, pattern),
          suggestedAction: `Remove or replace ${pattern} with the approved pattern for ${component.name}.`,
        }));
      }
    }

    for (const pattern of component.requiredPatterns ?? []) {
      if (ctx.rawText && !ctx.fullText.includes(pattern)) {
        pushIssue(issues, createIssue(config, {
          ruleId: 'component.required-pattern',
          componentName: component.name,
          filePath: ctx.file.filePath,
          expected: `Include required pattern ${pattern} for ${component.name} somewhere in the file.`,
          found: 'Pattern missing from the evaluated file content.',
          evidenceSnippet: evidenceExcerpt(ctx.rawText),
          suggestedAction: `Add the required pattern ${pattern} or align the component with the reference snapshot.`,
          confidence: 0.87,
        }));
      }
    }

    for (const state of component.states ?? []) {
      const statePattern = `${state.name}:`;
      const hasAnyState = ctx.fullText.includes(statePattern) || ctx.fullText.includes(`data-[state=${state.name}]`) || ctx.fullText.includes(`aria-${state.name}`);
      const touchedStateRegion = ctx.rawText.length > 0;
      if (!hasAnyState && touchedStateRegion) {
        pushIssue(issues, createIssue(config, {
          ruleId: 'component.missing-state',
          componentName: component.name,
          filePath: ctx.file.filePath,
          expected: `Provide explicit ${state.name} state support for ${component.name}.`,
          found: `${state.name} state not found in the evaluated file content.`,
          evidenceSnippet: evidenceExcerpt(ctx.rawText),
          suggestedAction: `Add the ${state.name} state styling/behavior expected by the reference snapshot.`,
          confidence: 0.82,
        }));
      }
    }

    for (const variant of component.variants ?? []) {
      const variantName = normalizeForMatch(variant.name);
      if (variantName && ctx.rawText.toLowerCase().includes('variant') && !normalizeForMatch(ctx.fullText).includes(variantName)) {
        pushIssue(issues, createIssue(config, {
          ruleId: 'component.variant-drift',
          componentName: component.name,
          filePath: ctx.file.filePath,
          expected: `Use approved ${component.name} variants from the reference snapshot.`,
          found: 'Changed code references variants that do not match the approved variant set.',
          evidenceSnippet: evidenceExcerpt(ctx.rawText),
          suggestedAction: `Align the variant values with the approved ${component.name} variants.`,
          confidence: 0.74,
        }));
      }
    }
  }
}

export function detectTokenMismatchIssues(
  issues: DriftIssue[],
  config: DesignMemoryConfig,
  tokenMatchers: TokenMatcher[],
  snapshot: ReferenceSnapshot,
  mappings: Mapping[],
  ctx: FileIssueContext,
) {
  for (const mapping of mappings) {
    const component = snapshot.components[mapping.referenceIndex];

    for (const tokenName of component.tokensUsed ?? []) {
      const matcher = tokenMatchers.find((entry) => normalizeForMatch(entry.token.name) === normalizeForMatch(tokenName));
      if (!matcher || matcher.aliases.length === 0) {
        continue;
      }

      const matchesAnyAlias = matcher.aliases.some((alias) => normalizeForMatch(ctx.fullText).includes(normalizeForMatch(alias)));
      const changedAnyTokenishThing = matcher.aliases.some((alias) => normalizeForMatch(ctx.rawText).includes(normalizeForMatch(alias))) || /(bg-|text-|border-|ring-|rounded-|shadow-|#)/.test(ctx.rawText);
      if (!matchesAnyAlias && changedAnyTokenishThing) {
        pushIssue(issues, createIssue(config, {
          ruleId: 'token.mismatch',
          componentName: component.name,
          filePath: ctx.file.filePath,
          expected: `Use approved token ${matcher.token.name} for ${component.name}.`,
          found: 'Changed code does not reference any approved token aliases or code hints.',
          evidenceSnippet: evidenceExcerpt(ctx.rawText),
          suggestedAction: `Replace hardcoded values with ${matcher.token.codeHints?.[0] ?? matcher.token.name} (token ${matcher.token.name}).`,
          confidence: 0.8,
        }));
      }
    }
  }
}

export function findDeterministicIssues(
  snapshot: ReferenceSnapshot,
  files: FileDiff[],
  mappings: Mapping[],
  config: DesignMemoryConfig,
  cwd: string,
) {
  const issues: DriftIssue[] = [];
  const theme = loadThemeTokens(cwd);
  const allowedHexes = new Set([
    ...(snapshot.tokens.map((token) => token.value?.toLowerCase()).filter(Boolean) as string[]),
    ...Array.from(theme.colors.values()).filter((value) => value.startsWith('#')),
  ]);
  const tokenMatchers = buildTokenMatchers(snapshot);

  for (const file of files) {
    const fileMappings = mappings.filter((mapping) => mapping.filePath === file.filePath);
    const fullText = file.fullContent ?? file.addedLines.join('\n');
    const isCodeLike = /\.[jt]sx?$/.test(file.filePath);
    const ctx: FileIssueContext = {
      file,
      defaultComponentName: fileMappings[0]?.componentName ?? (toPascalCase(getFileStem(file.filePath)) || 'UnknownComponent'),
      rawText: file.addedLines.join('\n'),
      fullText,
      styleUsages: isCodeLike
        ? extractStyleUsages(fullText, scriptKindForFile(file.filePath))
        : { classTokens: [], styleProps: [], inlineStyleCount: 0 },
    };

    detectStyleRuleIssues(issues, config, ctx, allowedHexes, theme, snapshot);
    detectComponentContractIssues(issues, snapshot, config, fileMappings, ctx);
    detectTokenMismatchIssues(issues, config, tokenMatchers, snapshot, fileMappings, ctx);
  }

  return issues;
}
