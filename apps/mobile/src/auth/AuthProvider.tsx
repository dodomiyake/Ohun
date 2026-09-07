import type { LoginRequest } from '@ohun/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { nativeAuthApi } from './api';
import { nativeCredentialStore, type CredentialStore } from './secure-store';

type AuthState = { status: 'restoring' | 'signedOut' | 'signedIn'; accessToken: string | null; user: { id: string; email: string; username: string } | null; restorationPending: boolean };
type AuthContextValue = AuthState & { login(input: LoginRequest): Promise<void>; signOutLocal(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, store = nativeCredentialStore }: PropsWithChildren<{ store?: CredentialStore }>) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', accessToken: null, user: null, restorationPending: false });

  useEffect(() => {
    let active = true;
    store.readRefreshToken().then((token) => {
      if (active) setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: Boolean(token) });
    }).catch(() => {
      if (active) setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
    });
    return () => { active = false; };
  }, [store]);

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

  const value = useMemo(() => ({ ...state, login, signOutLocal }), [state, login, signOutLocal]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
