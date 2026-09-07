import { Request, Response } from 'express';
import { HealthResponse } from '../types/call.types';

/**
 * Health check controller.
 * Endpoint: GET /api/health
 * Publicly accessible, used by container monitoring and uptime checkers.
 */
export function getHealth(req: Request, res: Response): void {
  const response: HealthResponse = {
    status: 'ok',
    service: 'call-api',
  };
  res.status(200).json(response);
}
