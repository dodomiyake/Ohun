import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { profileUpdateRequestSchema } from '@ohun/contracts';
import { AuthError, type AuthService } from './auth-service.js';
import { InvalidAvatarError } from './avatar-image.js';
import type { ProfileService } from './profile-service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 }, fileFilter: (_request, file, done) => done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => handler(request, response).catch(next);
const bearer = (request: Request) => { const value = request.header('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; };
const identity = async (request: Request, auth: AuthService) => { const token = bearer(request); if (!token) throw new AuthError(401, 'authentication_required', 'Authentication is required.'); return auth.authenticate(token); };

export function createProfileRouter(auth: AuthService, profiles: ProfileService) {
  const router = Router();
  router.get('/', asyncRoute(async (request, response) => { response.json(await profiles.read((await identity(request, auth)).userId)); }));
  router.get('/avatar', asyncRoute(async (request, response) => {
    const avatar = await profiles.readAvatar((await identity(request, auth)).userId);
    response.set('Cache-Control', 'private, no-store').type(avatar.contentType).send(Buffer.from(avatar.bytes));
  }));
  router.put('/', asyncRoute(async (request, response) => { response.json(await profiles.update(await identity(request, auth), profileUpdateRequestSchema.parse(request.body))); }));
  router.post('/avatar', (request, response, next) => { identity(request, auth).then((value) => { response.locals.identity = value; next(); }).catch(next); }, upload.single('avatar'), asyncRoute(async (request, response) => {
    if (!request.file) throw new AuthError(400, 'avatar_invalid', 'Choose a JPEG, PNG, or WebP image up to 5 MB.');
    try { response.json(await profiles.uploadAvatar(response.locals.identity as { userId: string; sessionId: string }, request.file.buffer)); }
    catch (error) { if (error instanceof InvalidAvatarError) throw new AuthError(400, 'avatar_invalid', error.message); throw error; }
  }));
  return router;
}
