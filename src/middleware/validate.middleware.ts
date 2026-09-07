import { Request, Response, NextFunction } from 'express';
import { normalizeAndValidateDestination } from '../utils/phoneValidator';

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Validates request payload for POST /api/call
 * Ensures:
 * - destination is present and valid international format (E.164)
 * - content is present, string, non-empty (open-ended string of ANY format/length)
 * - reason is optional, but if provided, must be a string
 */
export function validateCallPayload(req: Request, res: Response, next: NextFunction): void {
  const errors: ValidationErrorDetail[] = [];
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST_BODY',
      message: 'Request body must be a valid JSON object.',
    });
    return;
  }

  // 1. Destination validation
  if (body.destination === undefined || body.destination === null || body.destination === '') {
    errors.push({
      field: 'destination',
      message: 'Missing required field: destination',
    });
  } else {
    const destValidation = normalizeAndValidateDestination(body.destination);
    if (!destValidation.isValid) {
      errors.push({
        field: 'destination',
        message: destValidation.error || 'Invalid destination format',
      });
    } else {
      // Normalize destination to standard clean E.164 string
      req.body.destination = destValidation.normalized;
    }
  }

  // 2. Content validation
  // IMPORTANT: The "content" field must be completely open-ended.
  // It must accept ANY valid user-provided string.
  // Reject only if missing or not a string or purely whitespace.
  if (body.content === undefined || body.content === null) {
    errors.push({
      field: 'content',
      message: 'Missing required field: content',
    });
  } else if (typeof body.content !== 'string') {
    errors.push({
      field: 'content',
      message: 'Field "content" must be a string',
    });
  } else if (body.content.trim().length === 0) {
    errors.push({
      field: 'content',
      message: 'Field "content" cannot be empty',
    });
  }

  // 3. Reason validation (optional)
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== 'string') {
      errors.push({
        field: 'reason',
        message: 'Field "reason" must be a string if provided',
      });
    }
  }

  // 4. Retry parameters validation (optional)
  if (body.retryUntilAnswered !== undefined && body.retryUntilAnswered !== null) {
    if (typeof body.retryUntilAnswered !== 'boolean') {
      req.body.retryUntilAnswered = body.retryUntilAnswered === 'true' || body.retryUntilAnswered === 1;
    }
  }

  if (body.retryIntervalSeconds !== undefined && body.retryIntervalSeconds !== null) {
    const interval = Number(body.retryIntervalSeconds);
    if (isNaN(interval) || interval < 0 || interval > 86400) {
      errors.push({
        field: 'retryIntervalSeconds',
        message: 'Field "retryIntervalSeconds" must be a number between 0 and 86400 seconds (0 for immediate retry)',
      });
    } else {
      req.body.retryIntervalSeconds = interval;
    }
  }

  if (body.maxAttempts !== undefined && body.maxAttempts !== null) {
    const attempts = Number(body.maxAttempts);
    if (isNaN(attempts) || attempts < 0 || attempts > 1000) {
      errors.push({
        field: 'maxAttempts',
        message: 'Field "maxAttempts" must be a positive integer (0 for unlimited until answered)',
      });
    } else {
      req.body.maxAttempts = Math.floor(attempts);
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: errors[0].message,
      details: errors,
    });
    return;
  }

  next();
}

/**
 * Validates request payload for POST /api/test-call
 * Only requires a valid destination.
 */
export function validateTestCallPayload(req: Request, res: Response, next: NextFunction): void {
  const errors: ValidationErrorDetail[] = [];
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST_BODY',
      message: 'Request body must be a valid JSON object.',
    });
    return;
  }

  if (!body.destination || typeof body.destination !== 'string' || !body.destination.trim()) {
    errors.push({
      field: 'destination',
      message: 'Missing required field: destination',
    });
  } else {
    const destValidation = normalizeAndValidateDestination(body.destination);
    if (!destValidation.isValid) {
      errors.push({
        field: 'destination',
        message: destValidation.error || 'Invalid destination format',
      });
    } else {
      req.body.destination = destValidation.normalized;
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: errors[0].message,
      details: errors,
    });
    return;
  }

  next();
}
