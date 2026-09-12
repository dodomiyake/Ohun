import { Router, type Request, type Response, type NextFunction } from 'express';
import { AuthError, type AuthService } from './auth-service.js';
import { createRateLimiter } from './rate-limit.js';
import { createSessionService } from './session-service.js';

export function createSessionRouter(auth: AuthService, service = createSessionService()) {
  const router = Router();
  const identities = new WeakMap<Request, { userId: string; sessionId: string }>();
  router.use(createRateLimiter(60, 60_000, (request) => request.ip ?? 'unknown'));
  const route = (handler: (request: Request, response: Response) => Promise<void>) =>
    (request: Request, response: Response, next: NextFunction) => { void handler(request, response).catch(next); };
  router.use((request, response, next) => {
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) { next(new AuthError(401, 'authentication_required', 'Authentication is required.')); return; }
    void auth.authenticate(header.slice(7)).then((identity) => { identities.set(request, identity); response.locals.identity = identity; next(); },
      () => next(new AuthError(401, 'session_invalid', 'Authentication is required.')));
  });
  router.use(createRateLimiter(30, 60_000, (request) => identities.get(request)!.userId));
  router.get('/', route(async (_request, response) => { response.json(await service.list(response.locals.identity)); }));
  router.post('/revoke-others', route(async (_request, response) => { response.json(await service.revoke(response.locals.identity)); }));
  router.delete('/:sessionId', route(async (request, response) => { response.json(await service.revoke(response.locals.identity, request.params.sessionId)); }));
  return router;
}
