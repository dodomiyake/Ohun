import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('native authentication', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

  it('parses login credentials returned by the API', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: { id: 'u1', email: 'person@example.test', username: 'person', emailVerified: true } }) }));
    const { nativeAuthApi } = await import('./api');
    await expect(nativeAuthApi.login({ identifier: 'person', password: 'password', device: { platform: 'native', name: 'Phone' } })).resolves.toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('maps network failures to an offline-safe error', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret transport detail')));
    const { nativeAuthApi } = await import('./api');
    await expect(nativeAuthApi.resendVerification('person@example.test')).rejects.toMatchObject({ code: 'offline', message: 'Check your internet connection and try again.' });
  });

  it('stores only refresh credentials in Expo SecureStore', () => {
    const secureStore = readFileSync(join(root, 'src/auth/secure-store.ts'), 'utf8');
    const provider = readFileSync(join(root, 'src/auth/AuthProvider.tsx'), 'utf8');
    expect(secureStore).toContain("from 'expo-secure-store'");
    expect(secureStore).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    expect(provider).toContain('writeRefreshToken(response.refreshToken)');
    expect(provider).not.toMatch(/AsyncStorage|writeAccessToken|setItemAsync\([^)]*accessToken/);
  });

  it('removes deep-link token parameters and never logs them', () => {
    const route = readFileSync(join(root, 'app/verify-link.tsx'), 'utf8');
    expect(route).toContain("router.setParams({ token: '' })");
    expect(route).not.toMatch(/console\.|analytics|AsyncStorage|SecureStore/);
  });
});
