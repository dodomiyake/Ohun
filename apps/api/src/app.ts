import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { ApiEnv } from '@ohun/contracts';
import { healthResponseSchema } from '@ohun/contracts';
import { createDevInbox } from './dev-inbox.js';
import { createAuthRouter } from './auth-router.js';
import { AuthError, createAuthService, type AuthServiceDependencies } from './auth-service.js';
import { MemoryEmailProvider } from './providers.js';
import { MemoryAvatarStorage, type AvatarStorageProvider } from './providers.js';
import { MemoryPasswordBlocklist } from './security.js';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { createSessionRouter } from './session-router.js';
import { createSessionService } from './session-service.js';
import { createProfileRouter } from './profile-router.js';
import { createProfileService } from './profile-service.js';

type AppDependencies = Partial<Omit<AuthServiceDependencies, 'env'>> & { avatarStorage?: AvatarStorageProvider };

export function createApp(env: ApiEnv, dependencies?: AppDependencies) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    const payload = healthResponseSchema.parse({
      status: 'ok',
      service: 'ohun-api',
      version: '2.0.0-m1',
      timestamp: new Date().toISOString(),
    });
    res.status(200).json(payload);
  });

  const email = dependencies?.email ?? new MemoryEmailProvider();
  if (email instanceof MemoryEmailProvider) app.use('/dev', createDevInbox(email, { nodeEnv: env.NODE_ENV, enabled: env.DEV_INBOX_ENABLED, secret: env.DEV_INBOX_SECRET, ci: process.env.CI }));
  const auth = createAuthService({ env, email, blocklist: dependencies?.blocklist ?? new MemoryPasswordBlocklist(), now: dependencies?.now });
  app.use('/api/v1/sessions', createSessionRouter(auth, createSessionService(dependencies?.now)));
  app.use('/api/v1/auth', createAuthRouter(auth));
  app.use('/api/v1/profile', createProfileRouter(auth, createProfileService(dependencies?.avatarStorage ?? new MemoryAvatarStorage())));

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) { response.status(400).json({ error: { code: 'invalid_request', message: 'The request is invalid.', fields: error.flatten().fieldErrors } }); return; }
    if (error instanceof MulterError) { response.status(400).json({ error: { code: 'avatar_invalid', message: 'Choose an image up to 5 MB.' } }); return; }
    if (error instanceof AuthError) { response.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    console.error('[api] request failed', error instanceof Error ? error.message : 'unknown error');
    response.status(500).json({ error: { code: 'internal_error', message: 'The request could not be completed.' } });
  });

  return app;
}
