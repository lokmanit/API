export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  meta?: Record<string, unknown>;
}

// In-memory ring buffer of the latest 100 log events for the test dashboard
const recentLogs: LogEntry[] = [];
const MAX_LOGS = 100;

// Patterns to sanitize from log output
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /bearer/i,
  /api[-_]?key/i,
  /private/i,
];

export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[Truncated]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact bearer tokens if found in strings
    return obj.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

function writeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? (sanitizeObject(meta) as Record<string, unknown>) : undefined;

  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    level,
    message,
    meta: sanitizedMeta,
  };

  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.pop();
  }

  const output = `[${timestamp}] [${level.toUpperCase()}] ${message} ${
    sanitizedMeta ? JSON.stringify(sanitizedMeta) : ''
  }`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => writeLog('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => writeLog('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeLog('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => writeLog('debug', msg, meta),
  getRecentLogs: () => [...recentLogs],
  clearLogs: () => {
    recentLogs.length = 0;
  },
};
