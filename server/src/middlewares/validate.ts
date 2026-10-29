import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError, ErrorCode } from '../utils/response';

function issuesOf(err: ZodError) {
  return (err.issues || (err as any).errors || []).map((e: any) => ({
    field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
    message: e.message,
  }));
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Validation failed', issuesOf(err));
        return;
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid query parameters', issuesOf(err));
        return;
      }
      next(err);
    }
  };
}
