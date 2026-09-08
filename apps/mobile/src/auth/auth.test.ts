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

  it('uses the explicit native refresh credential and parses its rotated successor', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'next-access', refreshToken: 'next-refresh', expiresIn: 900, user: { id: 'u1', email: 'person@example.test', username: 'person', emailVerified: true } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { nativeAuthApi } = await import('./api');
    await expect(nativeAuthApi.refresh('a'.repeat(43))).resolves.toMatchObject({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/refresh', expect.objectContaining({ body: JSON.stringify({ refreshToken: 'a'.repeat(43) }) }));
  });

  it('stores only refresh credentials in Expo SecureStore', () => {
    const secureStore = readFileSync(join(root, 'src/auth/secure-store.ts'), 'utf8');
    const provider = readFileSync(join(root, 'src/auth/AuthProvider.tsx'), 'utf8');
    expect(secureStore).toContain("from 'expo-secure-store'");
    expect(secureStore).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    expect(provider).toContain('writeRefreshToken(response.refreshToken)');
    expect(provider).toContain('nativeAuthApi.refresh(token)');
    expect(provider).toContain('deleteRefreshToken()');
    expect(provider).not.toMatch(/AsyncStorage|writeAccessToken|setItemAsync\([^)]*accessToken/);
  });

  it('removes deep-link token parameters and never logs them', () => {
    const route = readFileSync(join(root, 'app/verify-link.tsx'), 'utf8');
    expect(route).toContain("router.setParams({ token: '' })");
    expect(route).not.toMatch(/console\.|analytics|AsyncStorage|SecureStore/);
  });

  it('clears the local credential before requesting server logout and exposes an accessible action', () => {
    const provider = readFileSync(join(root, 'src/auth/AuthProvider.tsx'), 'utf8');
    const settings = readFileSync(join(root, 'app/(app)/settings.tsx'), 'utf8');
    expect(provider.indexOf('deleteRefreshToken()')).toBeLessThan(provider.lastIndexOf('nativeAuthApi.logout'));
    expect(settings).toContain('accessibilityRole="button"');
    expect(settings).toContain("'Sign out'");
  });

  it('removes password-reset link tokens from route state and never persists or logs them', () => {
    const route = readFileSync(join(root, 'app/reset-password.tsx'), 'utf8');
    expect(route).toContain("router.setParams({ token: '' })");
    expect(route).not.toMatch(/console\.|analytics|AsyncStorage|SecureStore/);
  });

  it('uses the native image picker and never stores avatar bytes in general-purpose storage', () => {
    const profile = readFileSync(join(root, 'app/(app)/profile.tsx'), 'utf8');
    expect(profile).toContain("from 'expo-image-picker'");
    expect(profile).toContain('requestMediaLibraryPermissionsAsync');
    expect(profile).toContain('accessibilityLabel="Choose profile photo"');
    expect(profile).not.toMatch(/AsyncStorage|SecureStore|base64/);
  });
});
