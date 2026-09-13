import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AuthError, type AuthService } from './auth-service.js';
import { createRateLimiter } from './rate-limit.js';
import { createPeopleService } from './people-service.js';
const pagination = z.object({ cursor: z.string().regex(/^[a-f0-9]{24}$/).optional() }).strict();
export function createPeopleRouter(auth: AuthService, service = createPeopleService()) {
  const router = Router();
  const identities = new WeakMap<Request, string>();
  const route = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };
  router.use(createRateLimiter(120, 60_000, req => req.ip ?? 'unknown'));
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) { next(new AuthError(401, 'authentication_required', 'Authentication is required.')); return; }
    void auth.authenticate(header.slice(7)).then(identity => { identities.set(req, identity.userId); next(); }, () => next(new AuthError(401, 'session_invalid', 'Authentication is required.')));
  });
  const actor = (req: Request) => identities.get(req)!;
  router.use(createRateLimiter(60, 60_000, actor));
  router.get('/people/preferences', route(async (req, res) => { res.json(await service.preferences(actor(req))); }));
  router.put('/people/preferences', route(async (req, res) => { res.json(await service.setPreferences(actor(req), req.body)); }));
  router.post('/people/search', createRateLimiter(10, 60_000, actor), route(async (req, res) => { res.json(await service.search(actor(req), req.body)); }));
  router.get('/people', route(async (req, res) => { res.json(await service.list(actor(req), 'people', pagination.parse(req.query).cursor)); }));
  router.get('/invitations', route(async (req, res) => { res.json(await service.list(actor(req), 'invitations', pagination.parse(req.query).cursor)); }));
  router.post('/invitations', createRateLimiter(10, 3_600_000, actor), route(async (req, res) => { res.json(await service.invite(actor(req), req.body)); }));
  router.post('/invitations/:id/action', route(async (req, res) => { res.json(await service.action(actor(req), req.params.id!, req.body)); }));
  router.post('/people/:id/block', route(async (req, res) => { res.json(await service.block(actor(req), req.params.id!)); }));
  return router;
}
