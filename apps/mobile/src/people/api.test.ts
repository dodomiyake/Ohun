import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let api: typeof import('./api')['peopleApi'];
beforeEach(async () => { vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:5000'); vi.resetModules(); api = (await import('./api')).peopleApi; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('people transport', () => {
  it('authenticates search and sends usernames in a POST body', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ people: [], nextCursor: null }))); vi.stubGlobal('fetch', fetch);
    await api.search('access', 'Sapyenze');
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/v1/people/search', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer access' }), body: JSON.stringify({ username: 'Sapyenze' }) }));
  });
  it('preserves incoming/outgoing directions and pagination', async () => {
    const id = '507f1f77bcf86cd799439011';
    const invitation = { id, person: { id, username: 'other', displayName: 'Other' }, direction: 'incoming', state: 'pending', createdAt: '2026-10-11T00:00:00.000Z', expiresAt: '2026-10-18T00:00:00.000Z' };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ invitations: [invitation], nextCursor: id }))); vi.stubGlobal('fetch', fetch);
    expect((await api.invitations('access', id)).invitations[0]?.direction).toBe('incoming');
    expect(fetch.mock.calls[0]?.[0]).toContain(`?cursor=${id}`);
  });
  it('submits each request action without a client-supplied actor', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('{"ok":true}')); vi.stubGlobal('fetch', fetch);
    for (const action of ['accept', 'ignore', 'cancel'] as const) await api.action('access', '507f1f77bcf86cd799439011', action);
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([{ action: 'accept' }, { action: 'ignore' }, { action: 'cancel' }]);
  });
  it('surfaces rejected sessions instead of treating them as empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"code":"session_invalid","message":"Sign in again"}}', { status: 401 })));
    await expect(api.contacts('access')).rejects.toMatchObject({ status: 401, code: 'session_invalid' });
  });
  it('times out even when the response body stalls', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => new Promise(() => {}) }));
    const result = expect(api.contacts('access')).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(15000); await result;
  });
});
