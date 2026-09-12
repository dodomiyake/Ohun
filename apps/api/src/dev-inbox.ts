import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { MemoryEmailProvider } from './providers.js';

/** Local terminal access only; forwarded addresses and browser origins are never trusted. */
export function createDevInbox(email: MemoryEmailProvider, config: { nodeEnv: string; enabled: boolean; secret: string; ci?: string }) {
  const router = Router();
  if (config.nodeEnv !== 'development' || !config.enabled || config.ci || config.secret.length < 32) return router;
  router.get('/inbox', (request, response) => {
    const address = request.socket.remoteAddress;
    const local = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
    const presented = Buffer.from(request.header('X-Dev-Inbox-Key') ?? '');
    const expected = Buffer.from(config.secret);
    if (!local || request.header('origin') || request.header('x-forwarded-for') || presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      response.status(404).end(); return;
    }
    response.set('Cache-Control', 'no-store').json({ messages: email.messages.slice(-20) });
  });
  return router;
}
