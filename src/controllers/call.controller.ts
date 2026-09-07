import { Request, Response, NextFunction } from 'express';
import { callService } from '../services/call.service';
import { redialService } from '../services/redial.service';
import { runSipDiagnostics } from '../services/sipDiagnostics.service';
import { CallInitiateSuccessResponse, TestCallSuccessResponse, CallStatusResponse } from '../types/call.types';
import { getSanitizedConfig } from '../config';
import { logger } from '../utils/logger';

export class CallController {
  /**
   * POST /api/call
   * Initiates an outbound phone call with open-ended content.
   * If retryUntilAnswered is enabled, continuously retries calling until the recipient answers.
   */
  async initiateCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { destination, content, reason, retryUntilAnswered, retryIntervalSeconds, maxAttempts } = req.body;
      const idempotencyKey = req.idempotencyKey;

      // Check if persistent redial until answered is requested (or default true if flagged)
      if (retryUntilAnswered) {
        logger.info(`[CallController] Initiating persistent redial session for ${destination}`);
        const session = await redialService.startSession({
          destination,
          content,
          reason,
          retryIntervalSeconds,
          maxAttempts,
        });

        const response: CallInitiateSuccessResponse = {
          success: true,
          call_id: session.lastCallId || session.id,
          status: session.lastStatus || 'initiated',
          message: 'Call initiated. Retrying continuously until phone is answered.',
          retryUntilAnswered: true,
          redialTaskId: session.id,
        };

        res.status(201).json(response);
        return;
      }

      const result = await callService.initiateCall(
        {
          destination,
          content,
          reason,
        },
        idempotencyKey
      );

      if (!result.success) {
        res.status(result.statusCode).json({
          success: false,
          error: result.error || 'CALL_FAILED',
          message: result.message || 'Unable to initiate the call',
        });
        return;
      }

      const response: CallInitiateSuccessResponse = {
        success: true,
        call_id: result.call_id,
        status: result.status,
        message: 'Call initiated successfully',
        retryUntilAnswered: false,
      };

      res.status(result.statusCode === 200 ? 200 : 201).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/test-call
   * Test call endpoint used to verify telephony integration.
   */
  async testCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { destination } = req.body;

      const result = await callService.initiateCall({
        destination,
        content: 'System automated test call verification from Call Initiation API',
        reason: 'SYSTEM_TEST',
      });

      if (!result.success) {
        res.status(result.statusCode).json({
          success: false,
          error: result.error || 'CALL_FAILED',
          message: result.message || 'Unable to initiate the call',
        });
        return;
      }

      const response: TestCallSuccessResponse = {
        success: true,
        call_id: result.call_id,
        status: result.status,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/call/:call_id
   * Queries status of previously initiated call.
   */
  async getCallStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { call_id } = req.params;

      const call = await callService.getCallStatus(call_id);

      const response: CallStatusResponse = {
        success: true,
        call_id: call.call_id,
        status: call.status,
        destination: call.destination,
        reason: call.reason,
        created_at: call.created_at,
        updated_at: call.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/calls
   * Returns recent calls (useful for development test console)
   */
  async listRecentCalls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const calls = await callService.listRecentCalls(50);
      res.status(200).json({
        success: true,
        count: calls.length,
        calls,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/config
   * Returns sanitized configuration safe for display (no secrets)
   */
  getSanitizedConfig(req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      config: getSanitizedConfig(),
    });
  }

  /**
   * GET /api/logs
   * Returns recent sanitized application logs for testing console
   */
  getRecentLogs(req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      logs: logger.getRecentLogs(),
    });
  }

  /**
   * GET /api/redial/active
   * Returns currently active or latest persistent redial session
   */
  getActiveRedial(req: Request, res: Response): void {
    const destination = req.query.destination as string | undefined;
    const session = redialService.getActiveSession(destination);
    res.status(200).json({
      success: true,
      session,
    });
  }

  /**
   * POST /api/redial/stop
   * Manually halts an active redial loop
   */
  stopRedial(req: Request, res: Response): void {
    const { sessionId, destination } = req.body;
    if (sessionId) {
      const session = redialService.stopSession(sessionId);
      res.status(200).json({ success: true, message: 'Redial loop stopped', session });
      return;
    }
    if (destination) {
      redialService.stopSessionByDestination(destination);
      res.status(200).json({ success: true, message: `Redial loops stopped for ${destination}` });
      return;
    }
    redialService.stopAll();
    res.status(200).json({ success: true, message: 'All active redial loops stopped' });
  }

  /**
   * POST /api/redial/simulate-answer
   * Simulates recipient picking up the handset (for test verification)
   */
  async simulateAnswer(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.body;
    const session = await redialService.simulateAnswer(sessionId);
    res.status(200).json({
      success: true,
      message: 'Simulated answer signal processed. Phone marked as answered.',
      session,
    });
  }

  /**
   * GET /api/sip/diagnostics
   * Deep network and carrier handshake diagnostic probe
   */
  async getSipDiagnostics(req: Request, res: Response): Promise<void> {
    try {
      const report = await runSipDiagnostics();
      res.status(200).json({
        success: true,
        report,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: 'DIAGNOSTICS_FAILED',
        message: (err as Error).message,
      });
    }
  }
}

export const callController = new CallController();
