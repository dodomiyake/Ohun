import { describe, expect, it } from 'vitest';
import { healthResponseSchema, shellViewSchema, apiEnvSchema, loginRequestSchema, registerRequestSchema } from './index.js';

describe('contracts', () => {
  it('parses a valid health response', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      service: 'ohun-api',
      version: '2.0.0-m1',
      timestamp: new Date().toISOString(),
    });
    expect(parsed.status).toBe('ok');
  });

  it('accepts approved shell views only', () => {
    expect(shellViewSchema.parse('desktop')).toBe('desktop');
    expect(() => shellViewSchema.parse('dark')).toThrow();
  });

  it('applies test API env defaults without requiring MONGO_URI', () => {
    const env = apiEnvSchema.parse({ NODE_ENV: 'test' });
    expect(env.PORT).toBe(5000);
    expect(env.MONGO_URI).toBe('');
  });

  it('rejects insecure production configuration', () => {
    expect(() => apiEnvSchema.parse({ NODE_ENV: 'production' })).toThrow();
  });

  it('validates native registration and login payloads strictly', () => {
    expect(registerRequestSchema.parse({ email: 'person@example.test', username: 'person', password: 'not-trimmed' }).password).toBe('not-trimmed');
    expect(loginRequestSchema.parse({ identifier: 'person', password: 'secret', device: { platform: 'native', name: 'Phone' } }).device.platform).toBe('native');
    expect(() => loginRequestSchema.parse({ identifier: 'person', password: 'secret', device: { platform: 'web', name: 'Browser' } })).toThrow();
  });
});
