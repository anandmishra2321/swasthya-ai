import { Response } from 'express';

/**
 * Stable machine-readable error codes.
 * Frontend switches on these; human text may change freely.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  [key: string]: unknown;
}

interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCodeValue | string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

function requestIdOf(res: Response): string | undefined {
  const id = res.locals?.requestId;
  return typeof id === 'string' ? id : undefined;
}

/** Success envelope: { success, data, meta?, requestId? } */
export function sendOk<T>(res: Response, data: T, meta?: ApiMeta, status = 200): void {
  const requestId = requestIdOf(res);
  const body: Record<string, unknown> = { success: true, data };
  if (meta || requestId) {
    body.meta = { requestId, ...(meta || {}) };
  }
  if (requestId) body.requestId = requestId;
  res.status(status).json(body);
}

/**
 * Error envelope: { success:false, error:{ code, message, details? }, requestId? }
 *
 * Also mirrors a flat `error` string for backward compatibility with the
 * existing client bundle that reads `body.error` as a plain string.
 */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCodeValue | string,
  message: string,
  details?: unknown
): void {
  const requestId = requestIdOf(res);
  const body: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    // Legacy flat field — read by the current frontend ApiError handler.
    errorCode: code,
    message,
  };
  if (requestId) body.requestId = requestId;
  res.status(status).json(body as unknown as ApiErrorBody & Record<string, unknown>);
}

/** Truthful "not configured" response for optional integrations. */
export function sendNotConfigured(res: Response, integration: string, hint?: string): void {
  sendError(
    res,
    503,
    ErrorCode.INTEGRATION_NOT_CONFIGURED,
    `${integration} is not configured in this environment.`,
    hint ? { hint } : undefined
  );
}
