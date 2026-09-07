import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Bearer Token Authentication Middleware.
 *
 * Checks for the 'Authorization: Bearer <token>' header against
 * the configured API_AUTH_TOKEN.
 *
 * If missing or invalid, responds immediately with HTTP 401:
 * {
 *   "success": false,
 *   "error": "UNAUTHORIZED",
 *   "message": "Invalid or missing authentication token"
 * }
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Authentication failed: Missing Authorization header', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing authentication token',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    logger.warn('Authentication failed: Malformed Authorization header', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing authentication token',
    });
    return;
  }

  const token = parts[1].trim();
  const expectedToken = config.apiAuthToken;

  if (!token || token !== expectedToken) {
    logger.warn('Authentication failed: Invalid token provided', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing authentication token',
    });
    return;
  }

  // Token is valid; proceed
  next();
}
