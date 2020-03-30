import { urlencoded } from 'express';
import csrf from 'csurf';

import { rateLimiterMiddleware } from './services/rate-limiter';
import {
  ejsLayoutMiddlewareFactory,
  renderWithEjsLayout,
} from './services/renderer';
import {
  interactionEndControllerFactory,
  interactionStartControllerFactory,
} from './controllers/interaction';
import {
  getChangePasswordController,
  getResetPasswordController,
  getSendEmailVerificationController,
  getSignInController,
  getSignUpController,
  getVerifyEmailController,
  postChangePasswordController,
  postResetPasswordController,
  postSendEmailVerificationController,
  postSignInController,
  postSignUpController,
} from './controllers/user';
import {
  getJoinOrganizationController,
  postJoinOrganizationController,
} from './controllers/organisation';

module.exports = (app, provider) => {
  const csrfProtectionMiddleware = csrf();

  // wrap template within layout except for welcome.ejs page
  const routeWithTemplateRegex = /^\/users\/.+$/;
  app.use(routeWithTemplateRegex, ejsLayoutMiddlewareFactory(app));

  app.use(/^\/(users|interaction)/, (req, res, next) => {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
  });

  app.use(/^\/(users|interaction)/, urlencoded({ extended: false }));

  app.get('/interaction/:grant', interactionStartControllerFactory(provider));
  app.get(
    '/interaction/:grant/login',
    interactionEndControllerFactory(provider)
  );

  app.get('/users/sign-in', csrfProtectionMiddleware, getSignInController);
  app.post(
    '/users/sign-in',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postSignInController
  );
  app.get('/users/sign-up', csrfProtectionMiddleware, getSignUpController);
  app.post(
    '/users/sign-up',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postSignUpController
  );

  app.get(
    '/users/verify-email',
    csrfProtectionMiddleware,
    getVerifyEmailController
  );
  app.get(
    '/users/send-email-verification',
    csrfProtectionMiddleware,
    getSendEmailVerificationController
  );
  app.post(
    '/users/send-email-verification',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postSendEmailVerificationController
  );
  app.get(
    '/users/reset-password',
    csrfProtectionMiddleware,
    getResetPasswordController
  );
  app.post(
    '/users/reset-password',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postResetPasswordController
  );
  app.get(
    '/users/change-password',
    csrfProtectionMiddleware,
    getChangePasswordController
  );
  app.post(
    '/users/change-password',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postChangePasswordController
  );

  app.get(
    '/users/join-organization',
    csrfProtectionMiddleware,
    getJoinOrganizationController
  );
  app.post(
    '/users/join-organization',
    csrfProtectionMiddleware,
    rateLimiterMiddleware,
    postJoinOrganizationController
  );

  app.use(async (err, req, res, next) => {
    console.error(err);

    const statusCode = err.statusCode || 500;
    const templateName = 'error';
    const params = {
      error_code: err.statusCode || err,
      error_message: err.message,
    };

    if (req.originalUrl.match(routeWithTemplateRegex)) {
      // the layout has already been applied on this route (see above)
      return res.status(statusCode).render(templateName, params);
    }

    const html = await renderWithEjsLayout(templateName, params);

    return res.status(statusCode).send(html);
  });
};
