import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Attempt to load persisted vault password from data/sip_vault.json
let persistentVaultPassword = '';
try {
  const vaultPath = path.join(process.cwd(), 'data', 'sip_vault.json');
  if (fs.existsSync(vaultPath)) {
    const raw = fs.readFileSync(vaultPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.sipPassword && typeof parsed.sipPassword === 'string') {
      persistentVaultPassword = parsed.sipPassword.trim();
    }
  }
} catch {
  // Ignore filesystem read errors
}

export interface SipConfig {
  server: string;
  port: number;
  username: string;
  password?: string;
  callerId: string;
}

export interface ProviderApiConfig {
  url: string;
  key?: string;
}

export interface AppConfig {
  port: number;
  env: string;
  apiAuthToken: string;
  telephonyProvider: 'mock' | 'real';
  sip: SipConfig;
  providerApi: ProviderApiConfig;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  duplicateProtection: {
    windowSeconds: number;
  };
  callTimeoutMs: number;
}

export const config: AppConfig = {
  port: 3000,
  env: process.env.NODE_ENV || 'development',
  apiAuthToken: process.env.API_AUTH_TOKEN || 'call_api_sec_token_9f8d7c6b5a4',
  telephonyProvider: (process.env.TELEPHONY_PROVIDER?.toLowerCase() === 'real' ? 'real' : 'mock'),
  sip: {
    server: process.env.SIP_SERVER || '202.40.176.2',
    port: parseInt(process.env.SIP_PORT || '5060', 10),
    username: process.env.SIP_USERNAME || '09617552229',
    password: process.env.SIP_PASSWORD || persistentVaultPassword || '',
    callerId: process.env.SIP_CALLER_ID || '09617552229',
  },
  providerApi: {
    url: process.env.PROVIDER_API_URL || 'https://sip.ranksitt.net/vup/login',
    key: process.env.PROVIDER_API_KEY || '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20', 10),
  },
  duplicateProtection: {
    windowSeconds: parseInt(process.env.DUPLICATE_CALL_WINDOW_SEC || '30', 10),
  },
  callTimeoutMs: parseInt(process.env.CALL_TIMEOUT_MS || '10000', 10),
};

/**
 * Returns sanitized configuration safe for display/health/logging.
 * Strictly removes passwords, tokens, and API keys.
 */
export function getSanitizedConfig() {
  return {
    env: config.env,
    telephonyProvider: config.telephonyProvider,
    sip: {
      server: config.sip.server,
      port: config.sip.port,
      username: config.sip.username,
      callerId: config.sip.callerId,
      hasPassword: Boolean(config.sip.password && config.sip.password.trim().length > 0),
      isConfigured: Boolean(config.sip.server && config.sip.username),
      providerName: 'RanksTel / Ranks ITT (IPSP)',
    },
    providerApi: {
      url: config.providerApi.url,
      isConfigured: Boolean(config.providerApi.url),
    },
    rateLimit: {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
    },
    duplicateProtection: {
      windowSeconds: config.duplicateProtection.windowSeconds,
    },
    callTimeoutMs: config.callTimeoutMs,
  };
}
