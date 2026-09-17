import path from 'node:path';

import type { StyleUsages } from '../ast';
import { filterAuditableFiles, getStagedDiff, getStagedFileContent, isAuditableCodeFile } from '../git';
import { resolveReferenceSnapshot } from '../context';
import { detectAvailableBrain, promptBrain } from '../engine';
import type { DesignMemoryConfig, RuleId, RuleSeverity } from '../config';
import type { PullRequestScan } from '../github';
import type { loadReviews, loadReferenceSnapshot } from '../state';
import type { DetectionSource, DriftIssue, ReferenceSnapshot } from '../types';
import { hashParts, normalizeForMatch, uniqueStrings } from '../utils';

export type AuditDependencies = {
  getDiff?: typeof getStagedDiff;
  getFileContent?: typeof getStagedFileContent;
  getSnapshot?: typeof loadReferenceSnapshot;
  resolveSnapshot?: typeof resolveReferenceSnapshot;
  getBrain?: typeof detectAvailableBrain;
  askBrain?: typeof promptBrain;
  exit?: typeof process.exit;
};

export type AuditOptions = {
  cwd?: string;
  mode?: 'staged' | 'scan';
  diff?: string;
  label?: string;
  createBaseline?: boolean;
  json?: boolean;
  prScan?: PullRequestScan;
  persist?: boolean;
};

export type FileDiff = {
  filePath: string;
  diff: string;
  addedLines: string[];
  addedLineNumbers: Set<number>;
  hasHunks: boolean;
  fullContent?: string | null;
};

export type Mapping = {
  filePath: string;
  componentName: string;
  confidence: number;
  detectionSource: DetectionSource;
  referenceIndex: number;
};

export type TokenMatcher = {
  token: ReferenceSnapshot['tokens'][number];
  aliases: string[];
};

export type FileIssueContext = {
  file: FileDiff;
  defaultComponentName: string;
  rawText: string;
  fullText: string;
  styleUsages: StyleUsages;
};

export type IssueHistoryIndex = {
  reviews: ReturnType<typeof loadReviews>['reviews'];
  previousFingerprints: Set<string>;
  previousIssueKeys: Map<string, string>;
  historicalIssueKeys: Map<string, string>;
  historicalFingerprints: Set<string>;
  baselineFingerprints: Set<string>;
};

export type LlmAuditResponse = {
  explanations?: Array<{
    fingerprint: string;
    suggestedAction?: string;
  }>;
};

export function toIssueType(ruleId: RuleId): DriftIssue['issueType'] {
  if (ruleId.startsWith('component.variant')) return 'variant-drift';
  if (ruleId.startsWith('component.missing-state')) return 'missing-state';
  if (ruleId.startsWith('component.')) return 'component-reuse';
  if (ruleId.startsWith('token.')) return 'token-mismatch';
  return 'hardcoded-style';
}

export function getIssueKey(issue: Pick<DriftIssue, 'ruleId' | 'componentName' | 'filePath' | 'expected' | 'found'>) {
  return `${normalizeForMatch(issue.componentName)}::${issue.ruleId}::${issue.filePath}::${normalizeForMatch(issue.expected)}::${normalizeForMatch(issue.found)}`;
}

export function parseDiffIntoFiles(diff: string, config: DesignMemoryConfig, cwd = process.cwd()): FileDiff[] {
  return diff
    .split(/^FILE:\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [header, ...rest] = block.split('\n');
      const filePath = header.trim();
      const body = rest.join('\n');
      const addedLines: string[] = [];
      const addedLineNumbers = new Set<number>();

      // Track the new-file line counter through unified diff hunks so findings
      // can be filtered to lines that actually changed in this diff.
      let hasHunks = false;
      let currentLine = 0;
      for (const line of body.split('\n')) {
        const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          hasHunks = true;
          currentLine = Number(hunkMatch[1]);
          continue;
        }
        if (line.startsWith('+++') || line.startsWith('---')) {
          continue;
        }
        if (line.startsWith('+')) {
          addedLines.push(line.slice(1));
          if (hasHunks) {
            addedLineNumbers.add(currentLine);
            currentLine += 1;
          }
        } else if (hasHunks && (line.startsWith(' ') || line.startsWith('-'))) {
          if (line.startsWith(' ')) {
            currentLine += 1;
          }
        }
      }

      return {
        filePath,
        diff: body,
        addedLines,
        addedLineNumbers,
        hasHunks,
      };
    })
    .filter((file) => isAuditableCodeFile(file.filePath) && filterAuditableFiles([file.filePath], cwd).includes(file.filePath))
    .filter((file) => file.addedLines.length > 0);
}

export function getFileStem(filePath: string) {
  return path.basename(filePath).replace(/\.[^.]+$/, '');
}

export function matchComponents(snapshot: ReferenceSnapshot, files: FileDiff[]): Mapping[] {
  const mappings: Mapping[] = [];

  for (const file of files) {
    const stem = normalizeForMatch(getFileStem(file.filePath));
    const content = file.fullContent ?? file.addedLines.join('\n');
    const contentMatch = normalizeForMatch(content);

    snapshot.components.forEach((component, index) => {
      const candidates = uniqueStrings([
        component.name,
        ...(component.aliases ?? []),
        ...(component.codeMatches ?? []),
      ]);

      let confidence = 0;
      for (const candidate of candidates) {
        const normalized = normalizeForMatch(candidate);
        if (!normalized) continue;
        if (stem === normalized) {
          confidence = Math.max(confidence, 0.98);
        } else if (stem.includes(normalized) || normalized.includes(stem)) {
          confidence = Math.max(confidence, 0.86);
        } else if (contentMatch.includes(normalized)) {
          confidence = Math.max(confidence, 0.72);
        }
      }

      if (confidence >= 0.72) {
        mappings.push({
          filePath: file.filePath,
          componentName: component.name,
          confidence,
          detectionSource: 'deterministic',
          referenceIndex: index,
        });
      }
    });
  }

  return mappings.sort((left, right) => right.confidence - left.confidence);
}

export function getSeverity(config: DesignMemoryConfig, ruleId: RuleId): RuleSeverity {
  return config.rules[ruleId];
}

export function buildFingerprint(filePath: string, componentName: string, ruleId: string, expected: string, found: string) {
  return hashParts([
    normalizeForMatch(componentName),
    ruleId,
    filePath,
    normalizeForMatch(expected),
    normalizeForMatch(found),
  ]);
}

export function createIssue(
  config: DesignMemoryConfig,
  params: {
    ruleId: RuleId;
    componentName: string;
    filePath: string;
    expected: string;
    found: string;
    evidenceSnippet: string;
    suggestedAction: string;
    confidence?: number;
    detectionSource?: DetectionSource;
    line?: number;
    column?: number;
  },
): DriftIssue | null {
  const severity = getSeverity(config, params.ruleId);
  if (severity === 'ignore') {
    return null;
  }

  return {
    fingerprint: buildFingerprint(params.filePath, params.componentName, params.ruleId, params.expected, params.found),
    ruleId: params.ruleId,
    issueType: toIssueType(params.ruleId),
    severity,
    confidence: params.confidence ?? 0.98,
    componentName: params.componentName,
    filePath: params.filePath,
    expected: params.expected,
    found: params.found,
    evidenceSnippet: params.evidenceSnippet,
    suggestedAction: params.suggestedAction,
    detectionSource: params.detectionSource ?? 'deterministic',
    status: 'new',
    line: params.line,
    column: params.column,
  };
}

export function pushIssue(target: DriftIssue[], issue: DriftIssue | null) {
  if (!issue) return;
  if (target.some((entry) => entry.fingerprint === issue.fingerprint)) return;
  target.push(issue);
}

export function buildTokenMatchers(snapshot: ReferenceSnapshot): TokenMatcher[] {
  return snapshot.tokens.map((token) => ({
    token,
    aliases: uniqueStrings([token.name, ...(token.aliases ?? []), ...(token.codeHints ?? []), ...(snapshot.aliasMap?.[token.name] ?? [])]),
  }));
}

export function evidenceExcerpt(rawText: string, pattern?: string) {
  const lines = rawText.split('\n').filter((line) => line.trim().length > 0);
  if (pattern) {
    const match = lines.find((line) => line.includes(pattern));
    if (match) {
      return match.trim().slice(0, 160);
    }
  }
  return lines.slice(0, 3).join(' ').trim().slice(0, 160) || 'Changed lines in this file.';
}
