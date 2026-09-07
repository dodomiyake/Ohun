import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { ApiEnv } from '@ohun/contracts';
import { healthResponseSchema } from '@ohun/contracts';

export function createApp(env: ApiEnv) {
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

  return app;
}
