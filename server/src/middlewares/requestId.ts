import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

/**
 * Attaches a correlation id to every request/response.
 * Honours an inbound `x-request-id` when it is a sane token, otherwise mints one.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers[HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;

  const id =
    typeof candidate === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(candidate)
      ? candidate
      : crypto.randomUUID();

  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
