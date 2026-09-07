import express, { Express, Request, Response } from 'express';
import apiRoutes from './routes';
import { securityHeaders } from './middleware/security.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  // Basic security and CORS headers
  app.use(securityHeaders);

  // Parse JSON payloads with size safety
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request tracing and logging
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api')) {
        logger.info(`HTTP ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duration,
        });
      }
    });
    next();
  });

  // Mount API routes
  app.use('/api', apiRoutes);

  // Catch unhandled errors
  app.use(errorHandler);

  return app;
}

export const app = createApp();
