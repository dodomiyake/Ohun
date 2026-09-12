import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it('loads saved avatars with bearer authentication without putting tokens in the URL', async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  const { avatarImageSource } = await import('./api');
  const source = avatarImageSource('private-access-token', 'avatars/user/photo.webp');
  expect(source.headers.Authorization).toBe('Bearer private-access-token');
  expect(source.uri).not.toContain('private-access-token');
  expect(source.uri).toContain('/api/v1/profile/avatar?v=');
  expect(source.cache).toBe('reload');
});
