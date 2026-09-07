import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/login - GUI Login Endpoint
router.post('/auth/login', (req, res) => {
  authController.login(req, res);
});

// GET /api/sip/vault - Get SIP password vault status and SHA-256 fingerprint (Protected)
router.get('/sip/vault', requireAuth, (req, res) => {
  authController.getSipVault(req, res);
});

// POST /api/sip/vault - Save/Update SIP password and calculate cryptographic hash (Protected)
router.post('/sip/vault', requireAuth, (req, res) => {
  authController.updateSipVault(req, res);
});

export default router;
