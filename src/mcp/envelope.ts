import { z } from 'zod';

import { toErrorPayload } from '../lib/errors';

export const envelopeOutputSchema = {
  v: z.number(),
  kind: z.string(),
  summary: z.string(),
  data: z.unknown().optional(),
  refs: z.array(z.string()).optional(),
  truncated: z.boolean().optional(),
  next: z.array(z.string()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      hint: z.string().optional(),
    })
    .optional(),
};

export type Envelope = {
  v: 1;
  kind: string;
  summary: string;
  data?: unknown;
  refs?: string[];
  truncated?: boolean;
  next?: string[];
  error?: { code: string; message: string; hint?: string };
};

export function toToolResult(envelope: Envelope, options: { isError?: boolean } = {}) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(envelope) }],
    structuredContent: envelope as Record<string, unknown>,
    ...(options.isError ? { isError: true } : {}),
  };
}

export function toToolError(error: unknown) {
  const payload = toErrorPayload(error);
  return toToolResult(
    {
      v: 1,
      kind: 'error',
      summary: `${payload.code}: ${payload.message}`,
      error: payload,
    },
    { isError: true },
  );
}
