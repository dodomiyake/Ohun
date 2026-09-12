import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeSessionsApi } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const id = '507f1f77bcf86cd799439011';
describe('native session transport', () => {
  it('sends bearer credentials and validates device responses', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:5000');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sessions: [] })));
    vi.stubGlobal('fetch', fetch);
    expect(await nativeSessionsApi.list('access')).toEqual({ sessions: [] });
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/v1/sessions', expect.objectContaining({ headers: { Authorization: 'Bearer access' } }));
  });
  it('uses distinct individual and other-device endpoints', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:5000');
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true, revokedCount: 1 }))));
    vi.stubGlobal('fetch', fetch);
    await nativeSessionsApi.revoke('access', id); await nativeSessionsApi.revokeOthers('access');
    expect(fetch).toHaveBeenNthCalledWith(1, `http://localhost:5000/api/v1/sessions/${id}`, expect.objectContaining({ method: 'DELETE' }));
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/api/v1/sessions/revoke-others', expect.objectContaining({ method: 'POST' }));
  });
  it('surfaces offline and rejected-session errors', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:5000');
    const fetch = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    await expect(nativeSessionsApi.list('access')).rejects.toMatchObject({ code: 'offline' });
    await expect(nativeSessionsApi.list('access')).rejects.toMatchObject({ status: 401 });
  });
  it('rejects malformed session IDs before sending a request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(nativeSessionsApi.revoke('access', '../logout')).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
});
