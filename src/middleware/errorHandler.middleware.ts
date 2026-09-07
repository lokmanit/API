import { Request, Response, NextFunction } from 'express';
import { TelephonyError } from '../types/provider.types';
import { logger } from '../utils/logger';

/**
 * Central structured error handler for the REST API.
 * Guarantees that internal stack traces and secret credentials are never leaked.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Handle JSON parsing syntax error from body-parser
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    logger.warn('Malformed JSON request body received', { path: req.path });
    res.status(400).json({
      success: false,
      error: 'MALFORMED_JSON',
      message: 'Request payload contains malformed JSON syntax.',
    });
    return;
  }

  // Handle recognized TelephonyError instances
  if (err instanceof TelephonyError) {
    logger.error(`API TelephonyError [${err.code}]: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  // Unhandled / generic server errors
  const unhandledError = err instanceof Error ? err.message : 'An unexpected server error occurred';
  logger.error('Unhandled internal error encountered', {
    error: unhandledError,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred while processing the request.',
  });
}
