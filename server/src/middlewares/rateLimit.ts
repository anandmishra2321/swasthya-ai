import { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCode } from '../utils/response';

// Optional distributed backend. `redis` is an optional dependency; if it is not
// installed (or no REDIS_URL is configured) we transparently use the in-memory
// store so dev/zero-install setups keep working.
let createRedisClient: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  createRedisClient = require('redis').createClient;
} catch {
  createRedisClient = null;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let redisClient: any = null;
let useFallback = true;

export async function initRateLimitRedis(): Promise<void> {
  if (!createRedisClient) return;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return; // in-memory by default; opt-in via REDIS_URL
  try {
    redisClient = createRedisClient({ url: redisUrl });
    await redisClient.connect();
    useFallback = false;
    console.log('[RateLimiter] Redis client connected');
  } catch (err: any) {
    console.warn('[RateLimiter] Redis connection failed, using in-memory fallback:', err?.message);
    redisClient = null;
    useFallback = true;
  }
}

export function isUsingFallback(): boolean {
  return useFallback;
}

function generateKey(options: { name: string; identity: string; scope?: string }): string {
  if (options.scope) return `${options.name}:${options.scope}:${options.identity}`;
  return `${options.name}:${options.identity}`;
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
  keyGenerator?: (req: Request) => string;
  scopeExtractor?: (req: Request) => string | undefined;
}) {
  const { windowMs, max, name, keyGenerator, scopeExtractor } = options;

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const identity = keyGenerator
      ? keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown');
    const scope = scopeExtractor ? scopeExtractor(req) : undefined;
    const key = generateKey({ name, identity, scope });

    try {
      if (useFallback || !redisClient) {
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
          bucket = { count: 0, resetAt: now + windowMs };
          buckets.set(key, bucket);
        }
        bucket.count += 1;
        const remaining = Math.max(0, max - bucket.count);
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));
        if (bucket.count > max) {
          const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
          res.setHeader('Retry-After', String(retryAfterSeconds));
          sendError(res, 429, ErrorCode.RATE_LIMITED, `Too many requests. Please retry in ${retryAfterSeconds} second(s).`, { retryAfterSeconds });
          return;
        }
        next();
        return;
      }

      // Redis path
      const redisKey = `ratelimit:${name}:${key}`;
      const now = Date.now();
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.pExpire(redisKey, windowMs);
      }
      const remaining = Math.max(0, max - count);
      const ttl = await redisClient.pTTL(redisKey);
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)));
      if (count > max) {
        const retryAfterSeconds = Math.ceil((ttl > 0 ? ttl : windowMs) / 1000);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        sendError(res, 429, ErrorCode.RATE_LIMITED, `Too many requests. Please retry in ${retryAfterSeconds} second(s).`, { retryAfterSeconds });
        return;
      }
      next();
    } catch (err) {
      console.error('[RateLimiter] error, allowing request:', err);
      next();
    }
  };
}
export default rateLimit;
