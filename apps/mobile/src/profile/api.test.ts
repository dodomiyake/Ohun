import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const upload = vi.hoisted(() => ({ fetch: vi.fn(), exists: true, size: 100, write: vi.fn(), remove: vi.fn() }));
vi.mock('expo/fetch', () => ({ fetch: upload.fetch }));
vi.mock('expo-file-system', () => ({ Paths: { cache: 'file:///cache' }, File: class extends Blob {
  constructor() { super(['photo'], { type: 'image/jpeg' }); }
  uri = 'file:///cache/photo.webp';
  write(bytes: Uint8Array) { upload.write(bytes); }
  delete() { upload.remove(); }
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

it('downloads authenticated bytes to a disposable local image file', async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  upload.exists = true; upload.size = 100;
  upload.fetch.mockResolvedValueOnce(new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/webp' } }));
  const { downloadAvatar } = await import('./api');
  const image = await downloadAvatar('private-token');
  expect(upload.fetch).toHaveBeenLastCalledWith('https://api.example.test/api/v1/profile/avatar', expect.objectContaining({ headers: { Authorization: 'Bearer private-token' } }));
  expect(image.uri).toMatch(/^file:/); expect(image.uri).not.toContain('private-token');
  expect(upload.write).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  image.dispose(); expect(upload.remove).toHaveBeenCalled();
});
it('reports missing server photos distinctly without creating a cached file', async () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  upload.write.mockClear(); upload.fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
  const { downloadAvatar } = await import('./api');
  await expect(downloadAvatar('token')).rejects.toMatchObject({ code: 'photo_missing', status: 404 });
  expect(upload.write).not.toHaveBeenCalled();
});
