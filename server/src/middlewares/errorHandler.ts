import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Central error handler producing the standard error envelope:
 *   { success: false, error: { code, message, details? }, requestId }
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // Headers already flushed — hand back to Express to destroy the socket.
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode: number = err.statusCode || err.status || 500;
  let code: string = err.code && typeof err.code === 'string' ? err.code : ErrorCode.INTERNAL;
  let message: string = err.message || 'Internal Server Error';
  let details: unknown = err.details;

  // Mongoose duplicate key -> 409
  if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    code = ErrorCode.CONFLICT;
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : undefined;
    message = field ? `A record with this ${field} already exists.` : 'Duplicate record conflict.';
    details = err.keyValue;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = ErrorCode.VALIDATION_FAILED;
    details = Object.entries(err.errors || {}).map(([field, e]: [string, any]) => ({
      field,
      message: e?.message,
    }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = ErrorCode.VALIDATION_FAILED;
    message = `Invalid value for ${err.path}.`;
  }

  if (statusCode === 401 && code === ErrorCode.INTERNAL) code = ErrorCode.UNAUTHENTICATED;
  if (statusCode === 403 && code === ErrorCode.INTERNAL) code = ErrorCode.FORBIDDEN;
  if (statusCode === 404 && code === ErrorCode.INTERNAL) code = ErrorCode.NOT_FOUND;

  const requestId = typeof res.locals?.requestId === 'string' ? res.locals.requestId : undefined;

  logger.error('Unhandled request error', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    // Legacy flat fields kept for the existing frontend error reader.
    errorCode: code,
    ...(requestId ? { requestId } : {}),
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
}

/** 404 fallback for unmatched API routes. */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = typeof res.locals?.requestId === 'string' ? res.locals.requestId : undefined;
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `No API route matches ${req.method} ${req.originalUrl}`,
    },
    errorCode: ErrorCode.NOT_FOUND,
    ...(requestId ? { requestId } : {}),
  });
}
