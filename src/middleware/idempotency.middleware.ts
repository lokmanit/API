import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

/**
 * Extracts optional Idempotency-Key or X-Idempotency-Key header.
 */
export function extractIdempotencyKey(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (typeof rawKey === 'string' && rawKey.trim().length > 0) {
    req.idempotencyKey = rawKey.trim();
  }

  next();
}
