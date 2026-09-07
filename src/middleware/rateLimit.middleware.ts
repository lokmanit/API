import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const clientBuckets = new Map<string, RateLimitBucket>();

// Clean up stale buckets every 5 minutes (unreferenced so it doesn't block process exit)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of clientBuckets.entries()) {
    if (now > bucket.resetTime) {
      clientBuckets.delete(key);
    }
  }
}, 300000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Basic in-memory rate limiter for outbound call endpoints.
 * Protects against infinite loops from external automation workflows (e.g. n8n).
 */
export function callRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.max;

  // Key by IP and authorization token
  const authHeader = req.headers.authorization || '';
  const clientKey = `${req.ip}_${authHeader.slice(0, 16)}`;
  const now = Date.now();

  let bucket = clientBuckets.get(clientKey);

  if (!bucket || now > bucket.resetTime) {
    bucket = {
      count: 1,
      resetTime: now + windowMs,
    };
    clientBuckets.set(clientKey, bucket);
  } else {
    bucket.count += 1;
  }

  // Set rate limit headers
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetSeconds = Math.ceil((bucket.resetTime - now) / 1000);

  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (bucket.count > maxRequests) {
    logger.warn(`Rate limit exceeded for client ${clientKey}`, {
      count: bucket.count,
      limit: maxRequests,
      resetSeconds,
    });

    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Maximum ${maxRequests} call requests per ${Math.round(
        windowMs / 1000
      )} seconds allowed. Please retry in ${resetSeconds}s.`,
    });
    return;
  }

  next();
}

/**
 * Resets rate limit buckets (useful for test suites)
 */
export function resetRateLimits(): void {
  clientBuckets.clear();
}
