import type { LoginRequest } from '@ohun/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ApiError, nativeAuthApi } from './api';
import { nativeCredentialStore, type CredentialStore } from './secure-store';

type AuthState = { status: 'restoring' | 'signedOut' | 'signedIn'; accessToken: string | null; user: { id: string; email: string; username: string } | null; restorationPending: boolean };
type AuthUser = NonNullable<AuthState['user']>;
type AuthContextValue = AuthState & { login(input: LoginRequest): Promise<void>; restoreSession(): Promise<void>; updateUser(user: AuthUser): void; signOut(): Promise<void>; signOutLocal(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, store = nativeCredentialStore }: PropsWithChildren<{ store?: CredentialStore }>) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', accessToken: null, user: null, restorationPending: false });

  const restoreSession = useCallback(async () => {
    setState((current) => ({ ...current, status: 'restoring' }));
    let token: string | null;
    try { token = await store.readRefreshToken(); }
    catch (error) {
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
      throw error;
    }
    if (!token) { setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false }); return; }
    let response;
    try { response = await nativeAuthApi.refresh(token); }
    catch (error) {
      const rejected = error instanceof ApiError && error.status === 401;
      if (rejected) await store.deleteRefreshToken().catch(() => undefined);
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: !rejected });
      throw error;
    }
    try { await store.writeRefreshToken(response.refreshToken); }
    catch {
      await store.deleteRefreshToken().catch(() => undefined);
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
      throw new Error('Secure credential storage is unavailable. Sign in again.');
    }
    setState({ status: 'signedIn', accessToken: response.accessToken, user: response.user, restorationPending: false });
  }, [store]);

  useEffect(() => { void restoreSession().catch(() => undefined); }, [restoreSession]);

  const login = useCallback(async (input: LoginRequest) => {
    const response = await nativeAuthApi.login(input);
    try { await store.writeRefreshToken(response.refreshToken); }
    catch { setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false }); throw new Error('Secure credential storage is unavailable. Sign-in was not retained.'); }
    setState({ status: 'signedIn', accessToken: response.accessToken, user: response.user, restorationPending: false });
  }, [store]);

  const signOutLocal = useCallback(async () => {
    setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
    await store.deleteRefreshToken();
  }, [store]);

  const updateUser = useCallback((user: AuthUser) => { setState((current) => current.status === 'signedIn' ? { ...current, user } : current); }, []);

  const signOut = useCallback(async () => {
    const accessToken = state.accessToken ?? undefined;
    const refreshToken = await store.readRefreshToken().catch(() => null);
    setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
    await store.deleteRefreshToken().catch(() => undefined);
    await nativeAuthApi.logout(refreshToken ?? undefined, accessToken);
  }, [state.accessToken, store]);

  const value = useMemo(() => ({ ...state, login, restoreSession, updateUser, signOut, signOutLocal }), [state, login, restoreSession, updateUser, signOut, signOutLocal]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
