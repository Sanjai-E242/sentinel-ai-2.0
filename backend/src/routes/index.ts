import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { v1Router } from './v1/index.js';

const apiRouter = Router();

// Mount foundational routes
apiRouter.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sentinel-api',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      v1: '/api/v1'
    }
  });
});

apiRouter.use('/health', healthRouter);
apiRouter.use('/v1', v1Router);

export { apiRouter };
