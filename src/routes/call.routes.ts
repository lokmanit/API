import { Router } from 'express';
import { callController } from '../controllers/call.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { callRateLimiter } from '../middleware/rateLimit.middleware';
import { extractIdempotencyKey } from '../middleware/idempotency.middleware';
import { validateCallPayload, validateTestCallPayload } from '../middleware/validate.middleware';

const router = Router();

// POST /api/call - Initiate outbound phone call (Protected)
router.post(
  '/call',
  requireAuth,
  callRateLimiter,
  extractIdempotencyKey,
  validateCallPayload,
  (req, res, next) => {
    callController.initiateCall(req, res, next);
  }
);

// POST /api/test-call - Quick test call verification (Protected)
router.post(
  '/test-call',
  requireAuth,
  callRateLimiter,
  validateTestCallPayload,
  (req, res, next) => {
    callController.testCall(req, res, next);
  }
);

// GET /api/call/:call_id - Retrieve status of a specific call (Protected)
router.get(
  '/call/:call_id',
  requireAuth,
  (req, res, next) => {
    callController.getCallStatus(req, res, next);
  }
);

// GET /api/calls - List recent call logs (Protected)
router.get(
  '/calls',
  requireAuth,
  (req, res, next) => {
    callController.listRecentCalls(req, res, next);
  }
);

// GET /api/config - Retrieve sanitized configuration (Protected)
router.get(
  '/config',
  requireAuth,
  (req, res) => {
    callController.getSanitizedConfig(req, res);
  }
);

// GET /api/logs - Retrieve application log stream (Protected)
router.get(
  '/logs',
  requireAuth,
  (req, res) => {
    callController.getRecentLogs(req, res);
  }
);

// GET /api/redial/active - Query active persistent redial session (Protected)
router.get(
  '/redial/active',
  requireAuth,
  (req, res) => {
    callController.getActiveRedial(req, res);
  }
);

// POST /api/redial/stop - Stop active redial session (Protected)
router.post(
  '/redial/stop',
  requireAuth,
  (req, res) => {
    callController.stopRedial(req, res);
  }
);

// POST /api/redial/simulate-answer - Simulate answer for test verification (Protected)
router.post(
  '/redial/simulate-answer',
  requireAuth,
  (req, res) => {
    callController.simulateAnswer(req, res);
  }
);

// GET /api/sip/diagnostics - Comprehensive SIP carrier and network diagnostic probe (Protected)
router.get(
  '/sip/diagnostics',
  requireAuth,
  (req, res) => {
    callController.getSipDiagnostics(req, res);
  }
);

export default router;
