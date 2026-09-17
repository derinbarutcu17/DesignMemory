import fs from 'node:fs';
import path from 'node:path';

import { loadReferenceSnapshot } from '../state';
import type { Decision } from './schema';

export type LifecycleContext = {
  now: Date;
  tokenValues: Map<string, string>;
  fileExists: (repoRelativePath: string) => boolean;
};

export type DecisionEvaluation = {
  status: Decision['status'];
  invalidatedReason?: string;
};

export function buildLifecycleContext(cwd: string): LifecycleContext {
  const snapshot = loadReferenceSnapshot(cwd);
  const tokenValues = new Map<string, string>();
  for (const token of snapshot?.tokens ?? []) {
    tokenValues.set(token.name, token.value ?? '');
  }

  return {
    now: new Date(process.env.DM_NOW ?? Date.now()),
    tokenValues,
    fileExists: (repoRelativePath: string) => {
      const resolved = path.resolve(cwd, repoRelativePath);
      const root = path.resolve(cwd);
      if (!resolved.startsWith(root)) {
        return false;
      }
      return fs.existsSync(resolved);
    },
  };
}

export function evaluateDecision(decision: Decision, ctx: LifecycleContext): DecisionEvaluation {
  if (decision.status === 'superseded') {
    return { status: 'superseded' };
  }

  if (decision.expiresAt) {
    const expiry = new Date(decision.expiresAt).getTime();
    if (!Number.isNaN(expiry) && ctx.now.getTime() >= expiry) {
      return { status: 'expired' };
    }
  }

  for (const ref of decision.tokenRefs ?? []) {
    const current = ctx.tokenValues.get(ref.path);
    if (current === undefined) {
      return { status: 'invalidated', invalidatedReason: `token ${ref.path} no longer exists` };
    }
    if (current !== ref.valueAtCreation) {
      return { status: 'invalidated', invalidatedReason: `token ${ref.path} changed` };
    }
  }

  const hasScopedTarget =
    Boolean(decision.target.glob) ||
    Boolean(decision.target.component) ||
    Boolean(decision.target.fingerprint) ||
    Boolean(decision.target.tokenPath);

  if (decision.target.file && !hasScopedTarget && !ctx.fileExists(decision.target.file)) {
    return { status: 'invalidated', invalidatedReason: `target file ${decision.target.file} no longer exists` };
  }

  return { status: 'active' };
}

export function evaluateDecisions(decisions: Decision[], ctx: LifecycleContext): Decision[] {
  return decisions.map((decision) => ({ ...decision, status: evaluateDecision(decision, ctx).status }));
}

export function decisionEvaluationReason(decision: Decision, ctx: LifecycleContext): string | undefined {
  return evaluateDecision(decision, ctx).invalidatedReason;
}
