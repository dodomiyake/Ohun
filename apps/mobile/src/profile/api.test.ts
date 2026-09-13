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

const upload = vi.hoisted(() => ({ fetch: vi.fn(), exists: true, size: 100 }));
vi.mock('expo/fetch', () => ({ fetch: upload.fetch }));
vi.mock('expo-file-system', () => ({ File: class extends Blob {
  constructor() { super(['photo'], { type: 'image/jpeg' }); }
  get exists() { return upload.exists; }
  get size() { return upload.size; }
} }));
it('uploads file contents with bearer authentication and a generated multipart boundary', async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  upload.exists = true; upload.size = 100;
  upload.fetch.mockResolvedValue(new Response(JSON.stringify({ user: { id: '1', email: 'test@example.test', username: 'test', emailVerified: true }, profile: null })));
  const { nativeProfileApi } = await import('./api');
  await nativeProfileApi.uploadAvatar('access', { uri: 'file:///photo.jpg' });
  const [url, options] = upload.fetch.mock.calls.at(-1)!;
  expect(url).toBe('https://api.example.test/api/v1/profile/avatar');
  expect(options.headers).toEqual({ Authorization: 'Bearer access' });
  expect(options.body.get('avatar')).toBeInstanceOf(Blob);
});
it('rejects missing and oversized photos before transport', async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  upload.fetch.mockClear();
  const { nativeProfileApi } = await import('./api');
  upload.exists = false;
  await expect(nativeProfileApi.uploadAvatar('access', { uri: 'file:///missing' })).rejects.toMatchObject({ code: 'photo_unavailable' });
  upload.exists = true; upload.size = 6 * 1024 * 1024;
  await expect(nativeProfileApi.uploadAvatar('access', { uri: 'file:///large.jpg' })).rejects.toMatchObject({ code: 'photo_too_large' });
  expect(upload.fetch).not.toHaveBeenCalled();
  upload.size = 100;
});
