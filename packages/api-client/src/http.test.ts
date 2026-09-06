import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http.js';

describe('createHttpClient', () => {
  it('parses a successful health response', async () => {
    const body = {
      status: 'ok',
      service: 'ohun-api',
      version: '2.0.0-m1',
      timestamp: new Date().toISOString(),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });

    const client = createHttpClient({
      baseUrl: 'http://localhost:5000',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getHealth()).resolves.toEqual(body);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:5000/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
