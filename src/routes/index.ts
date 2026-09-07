import { Router } from 'express';
import healthRoutes from './health.routes';
import callRoutes from './call.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/', callRoutes);
router.use('/', authRoutes);

export default router;
