import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  loginRequestSchema,
  logoutRequestSchema,
  passwordChangeRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  verificationCodeRequestSchema,
  verificationLinkRequestSchema,
} from '@ohun/contracts';
import { AuthError, type AuthService } from './auth-service.js';
import { createRateLimiter } from './rate-limit.js';

const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => handler(request, response).catch(next);
const bearer = (request: Request) => {
  const value = request.header('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
};

export function createAuthRouter(auth: AuthService) {
  const router = Router();
  const ipLimit = createRateLimiter(30, 60_000, (request) => request.ip ?? 'unknown');
  const accountLimit = createRateLimiter(10, 60_000, (request) => String(request.body?.identifier ?? request.body?.email ?? '').normalize('NFKC').toLocaleLowerCase('en-US'));
  router.use(ipLimit);

  router.post('/register', accountLimit, asyncRoute(async (request, response) => { response.status(201).json(await auth.register(registerRequestSchema.parse(request.body))); }));
  router.post('/verification/code', accountLimit, asyncRoute(async (request, response) => { const input = verificationCodeRequestSchema.parse(request.body); response.json(await auth.verifyCode(input.email, input.code)); }));
  router.post('/verification/link', accountLimit, asyncRoute(async (request, response) => { const input = verificationLinkRequestSchema.parse(request.body); response.json(await auth.verifyLink(input.token)); }));
  router.post('/verification/resend', accountLimit, asyncRoute(async (request, response) => { const input = resendVerificationRequestSchema.parse(request.body); response.json(await auth.resend(input.email)); }));
  router.post('/login', accountLimit, asyncRoute(async (request, response) => { response.json(await auth.login(loginRequestSchema.parse(request.body))); }));
  router.post('/refresh', asyncRoute(async (request, response) => { const input = refreshRequestSchema.parse(request.body); response.json(await auth.refresh(input.refreshToken)); }));
  router.post('/logout', asyncRoute(async (request, response) => { const input = logoutRequestSchema.parse(request.body); response.json(await auth.logout(input.refreshToken, bearer(request))); }));
  router.post('/password/reset/request', accountLimit, asyncRoute(async (request, response) => { const input = passwordResetRequestSchema.parse(request.body); response.json(await auth.requestPasswordReset(input.email)); }));
  router.post('/password/reset/confirm', asyncRoute(async (request, response) => { const input = passwordResetConfirmRequestSchema.parse(request.body); response.json(await auth.confirmPasswordReset(input.token, input.newPassword)); }));
  router.post('/password/change', asyncRoute(async (request, response) => {
    const token = bearer(request);
    if (!token) throw new AuthError(401, 'authentication_required', 'Authentication is required.');
    const identity = await auth.authenticate(token);
    response.json(await auth.changePassword(identity, passwordChangeRequestSchema.parse(request.body)));
  }));
  router.get('/me', asyncRoute(async (request, response) => {
    const token = bearer(request);
    if (!token) throw new AuthError(401, 'authentication_required', 'Authentication is required.');
    const identity = await auth.authenticate(token);
    response.json(await auth.me(identity.userId));
  }));
  return router;
}
