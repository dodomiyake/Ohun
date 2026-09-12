// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), logout: vi.fn(), login: vi.fn(), listener: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: (_event: string, callback: unknown) => { mocks.listener(callback); return { remove: vi.fn() }; } } }));
vi.mock('./secure-store', () => ({ nativeCredentialStore: {} }));
vi.mock('./api', () => ({ ApiError: class extends Error {}, nativeAuthApi: mocks }));
const response = { accessToken: 'access', refreshToken: 'successor', expiresIn: 900, user: { id: 'u1', email: 'p@example.test', username: 'person' } };
let auth: ReturnType<typeof useAuth>;
function Consumer() { auth = useAuth(); return null; }
let root: Root;
const store = { readRefreshToken: vi.fn(), writeRefreshToken: vi.fn(), deleteRefreshToken: vi.fn() };
async function mount() { await act(async () => { root.render(createElement(AuthProvider, { store }, createElement(Consumer))); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(document.createElement('div'));
  store.readRefreshToken.mockResolvedValue('saved'); store.writeRefreshToken.mockResolvedValue(undefined); store.deleteRefreshToken.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(response); mocks.logout.mockResolvedValue({ ok: true });
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
describe('native session lifecycle', () => {
  it('renews before expiry without leaving the signed-in state', async () => {
    await mount();
    expect(auth.status).toBe('signedIn');
    await act(async () => { await vi.advanceTimersByTimeAsync(840_000); });
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    expect(auth.status).toBe('signedIn');
    expect(store.writeRefreshToken).toHaveBeenCalledTimes(2);
  });
  it('does not restore a session after sign-out while a refresh is pending', async () => {
    let finish!: (value: typeof response) => void;
    mocks.refresh.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await mount();
    await act(async () => { await auth.signOutLocal(); });
    await act(async () => { finish(response); });
    expect(auth.status).toBe('signedOut');
    expect(store.writeRefreshToken).not.toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledWith('successor');
  });
  it('serializes sign-out after an in-progress credential write', async () => {
    let finish!: () => void;
    store.writeRefreshToken.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    await mount();
    let signOut!: Promise<void>;
    await act(async () => { signOut = auth.signOutLocal(); });
    expect(store.deleteRefreshToken).not.toHaveBeenCalled();
    await act(async () => { finish(); await signOut; });
    expect(store.deleteRefreshToken).toHaveBeenCalledTimes(1);
    expect(auth.status).toBe('signedOut');
  });
});
