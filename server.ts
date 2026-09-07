import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/app.ts';
import { logger } from './src/utils/logger';
import { config } from './src/config';

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development preview
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(path.posix.join('/', '*'), (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`========================================================`);
    logger.info(`📞 Call Initiation REST API ready on http://0.0.0.0:${PORT}`);
    logger.info(`   Active Provider: ${config.telephonyProvider.toUpperCase()}`);
    logger.info(`   Auth Token Required: Authorization: Bearer <token>`);
    logger.info(`   Health Endpoint: http://0.0.0.0:${PORT}/api/health`);
    logger.info(`========================================================`);
  });
}

startServer();
