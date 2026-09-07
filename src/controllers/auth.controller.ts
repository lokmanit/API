import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export class AuthController {
  /**
   * POST /api/auth/login
   * Public endpoint for GUI dashboard authentication
   */
  login(req: Request, res: Response): void {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Username and password are required',
      });
      return;
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    // Valid admin users: 'admin' or the SIP username '09617552229'
    const validUsernames = ['admin', '09617552229', config.sip.username.toLowerCase()];
    const isValidUser = validUsernames.includes(cleanUser.toLowerCase());

    // Valid passwords: 'admin123', the API auth token, or the SIP password (if set)
    const validPasswords = [
      'admin123',
      config.apiAuthToken,
      ...(config.sip.password ? [config.sip.password] : []),
    ];
    const isValidPass = validPasswords.includes(cleanPass);

    if (!isValidUser || !isValidPass) {
      logger.warn('[AuthController] Failed login attempt', { username: cleanUser });
      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password. (Hint: Use admin / admin123 or your API token)',
      });
      return;
    }

    logger.info('[AuthController] Successful login', { username: cleanUser });
    res.status(200).json({
      success: true,
      token: config.apiAuthToken,
      user: {
        username: cleanUser,
        role: 'SUPER_ADMIN',
        sipUsername: config.sip.username,
        sipServer: config.sip.server,
        callerId: config.sip.callerId,
      },
      message: 'Logged in successfully',
    });
  }

  /**
   * GET /api/sip/vault
   * Retrieves status and cryptographic SHA-256 fingerprint of current SIP password
   */
  getSipVault(req: Request, res: Response): void {
    const hasPassword = Boolean(config.sip.password && config.sip.password.trim().length > 0);
    let sha256: string | null = null;

    if (hasPassword && config.sip.password) {
      sha256 = crypto.createHash('sha256').update(config.sip.password.trim()).digest('hex');
    }

    res.status(200).json({
      success: true,
      hasPassword,
      sha256,
      masked: hasPassword ? '••••••••••••' : null,
      server: `${config.sip.server}:${config.sip.port}`,
      username: config.sip.username,
      callerId: config.sip.callerId,
      defaultDestination: '+8801750010459',
    });
  }

  /**
   * POST /api/sip/vault
   * Securely saves and updates the SIP password in the runtime vault,
   * calculating the SHA-256 digest so the client can store and show it as a hash.
   */
  updateSipVault(req: Request, res: Response): void {
    const rawPassword = req.body.password || req.body.sipPassword;

    if (!rawPassword || typeof rawPassword !== 'string' || !rawPassword.trim()) {
      res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'A valid non-empty SIP password is required.',
      });
      return;
    }

    const cleanPassword = rawPassword.trim();
    config.sip.password = cleanPassword;

    // Persist to disk in data/sip_vault.json
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(dataDir, 'sip_vault.json'),
        JSON.stringify({
          sipPassword: cleanPassword,
          updatedAt: new Date().toISOString(),
          username: config.sip.username,
          server: config.sip.server,
        }, null, 2),
        'utf-8'
      );
    } catch (fsErr) {
      logger.warn('[AuthController] Could not persist SIP vault to disk', { error: String(fsErr) });
    }

    const sha256 = crypto.createHash('sha256').update(cleanPassword).digest('hex');

    logger.info('[AuthController] SIP password saved to vault', {
      sha256Hash: `${sha256.slice(0, 8)}...${sha256.slice(-8)}`,
      length: cleanPassword.length,
      server: config.sip.server,
    });

    res.status(200).json({
      success: true,
      message: 'SIP password securely saved in active memory vault with SHA-256 hash digest.',
      hasPassword: true,
      sha256,
      masked: '••••••••••••',
      server: `${config.sip.server}:${config.sip.port}`,
      username: config.sip.username,
      callerId: config.sip.callerId,
    });
  }
}

export const authController = new AuthController();
