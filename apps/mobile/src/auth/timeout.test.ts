import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
it('bounds a stalled registration and aborts the request without retrying', async () => {
  vi.useFakeTimers(); vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  const fetch = vi.fn().mockImplementation(() => new Promise(() => undefined)); vi.stubGlobal('fetch', fetch);
  const { nativeAuthApi } = await import('./api');
  const result = nativeAuthApi.register({ username: 'testperson', email: 'test@example.test', password: 'test password phrase' });
  const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(15_000); await assertion;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
});
it('also bounds a response body that never finishes loading', async () => {
  vi.useFakeTimers(); vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => undefined) }));
  const { nativeAuthApi } = await import('./api');
  const assertion = expect(nativeAuthApi.resendVerification('test@example.test')).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(15_000); await assertion;
});
