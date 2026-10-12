import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
const app = createApp(loadEnv({ NODE_ENV: 'test' }));
describe('people HTTP authentication boundaries', () => {
  it('rejects unauthenticated discovery and invitation access', async () => {
    for (const path of ['/api/v1/people', '/api/v1/people/preferences', '/api/v1/invitations']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
  });
  it('does not intercept existing registration or health routes', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/register').send({})).status).toBe(400);
  });
  it('rejects missing credentials on every new mutation', async () => {
    for (const path of ['/api/v1/people/search', '/api/v1/invitations', '/api/v1/invitations/507f1f77bcf86cd799439011/action', '/api/v1/people/507f1f77bcf86cd799439011/block']) expect((await request(app).post(path).send({})).status).toBe(401);
    expect((await request(app).put('/api/v1/people/preferences').send({ byUsername: true })).status).toBe(401);
  });
});
