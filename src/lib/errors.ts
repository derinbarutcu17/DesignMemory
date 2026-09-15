export type DesignMemoryErrorCode =
  | 'DM_E_NO_CONFIG'
  | 'DM_E_NO_SNAPSHOT'
  | 'DM_E_NOT_GIT'
  | 'DM_E_GIT_FAILED'
  | 'DM_E_PATH_OUTSIDE_REPO'
  | 'DM_E_PATH_NOT_FOUND'
  | 'DM_E_PARSE_TOKENS'
  | 'DM_E_PARSE_DESIGNMD'
  | 'DM_E_MEMORY_CORRUPT'
  | 'DM_E_SUPERSEDE_INVALID'
  | 'DM_E_DECISION_LIMIT'
  | 'DM_E_COMPONENT_NOT_FOUND'
  | 'DM_E_UNKNOWN_KIND'
  | 'DM_E_INVALID_INPUT'
  | 'DM_E_INTERNAL';

export class DesignMemoryError extends Error {
  readonly code: DesignMemoryErrorCode;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(
    code: DesignMemoryErrorCode,
    message: string,
    options: { hint?: string; details?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'DesignMemoryError';
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isDesignMemoryError(value: unknown): value is DesignMemoryError {
  return value instanceof DesignMemoryError;
}

export type ErrorPayload = {
  code: DesignMemoryErrorCode;
  message: string;
  hint?: string;
};

export function toErrorPayload(error: unknown): ErrorPayload {
  if (isDesignMemoryError(error)) {
    return {
      code: error.code,
      message: error.message,
      ...(error.hint ? { hint: error.hint } : {}),
    };
  }

  return {
    code: 'DM_E_INTERNAL',
    message: error instanceof Error ? error.message : String(error),
  };
}
