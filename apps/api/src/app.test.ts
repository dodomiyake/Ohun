import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { loadEnv } from './env.js';

describe('API health', () => {
  it('returns a validated health payload', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '5000',
      CLIENT_ORIGIN: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test-secret',
      TOKEN_HMAC_MASTER: 'test-secret',
      COOKIE_SECURE: 'false',
      MONGO_URI: '',
    });

    const app = createApp(env);
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('ohun-api');
  });
});
