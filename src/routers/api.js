import { Router } from 'express';
import { getOrganizationInfoController } from '../controllers/api';
import { rateLimiterMiddleware } from '../services/rate-limiter';

export const apiRouter = () => {
  const apiRouter = Router();

  apiRouter.get(
    '/organization-info',
    rateLimiterMiddleware,
    getOrganizationInfoController
  );

  apiRouter.use(async (err, req, res, next) => {
    console.error(err);

    const statusCode = err.statusCode || 500;

    return res
      .status(statusCode)
      .json({ message: err.message || err.statusMessage });
  });

  return apiRouter;
};

export default apiRouter;