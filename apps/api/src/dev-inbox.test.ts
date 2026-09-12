import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createDevInbox } from './dev-inbox.js';
import { MemoryEmailProvider } from './providers.js';
const secret = 'a'.repeat(43);
function app(nodeEnv = 'development', enabled = true, ci?: string) {
  const email = new MemoryEmailProvider(); email.messages.push({ to: 'test@example.test', subject: 'Verify', text: 'local test message' });
  const server = express(); server.use(createDevInbox(email, { nodeEnv, enabled, secret, ci })); return server;
}
describe('local inbox boundaries', () => {
  it('requires the private header even on loopback', async () => {
    expect((await request(app()).get('/inbox')).status).toBe(404);
    const result = await request(app()).get('/inbox').set('X-Dev-Inbox-Key', secret);
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store'); expect(result.body.messages).toHaveLength(1);
  });
  it.each(['production', 'test'])('does not register inbox in %s', async (mode) => {
    expect((await request(app(mode)).get('/inbox').set('X-Dev-Inbox-Key', secret)).status).toBe(404);
  });
  it('rejects disabled, CI, browser-origin, and forwarded requests', async () => {
    for (const server of [app('development', false), app('development', true, 'true')]) expect((await request(server).get('/inbox').set('X-Dev-Inbox-Key', secret)).status).toBe(404);
    for (const header of ['Origin', 'X-Forwarded-For']) expect((await request(app()).get('/inbox').set('X-Dev-Inbox-Key', secret).set(header, '127.0.0.1')).status).toBe(404);
  });
});
