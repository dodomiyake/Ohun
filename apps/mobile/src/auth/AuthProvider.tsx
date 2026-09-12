import type { LoginRequest } from '@ohun/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { singleFlight } from './single-flight';
import { ApiError, nativeAuthApi } from './api';
import { nativeCredentialStore, type CredentialStore } from './secure-store';

type AuthState = { status: 'restoring' | 'signedOut' | 'signedIn'; accessToken: string | null; user: { id: string; email: string; username: string } | null; restorationPending: boolean; expiresAt?: number };
type AuthUser = NonNullable<AuthState['user']>;
type AuthContextValue = AuthState & { login(input: LoginRequest): Promise<void>; restoreSession(): Promise<void>; updateUser(user: AuthUser): void; signOut(): Promise<void>; signOutLocal(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, store = nativeCredentialStore }: PropsWithChildren<{ store?: CredentialStore }>) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', accessToken: null, user: null, restorationPending: false });

  const generation = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const credentialQueue = useRef<Promise<unknown>>(Promise.resolve());
  const credentialOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = credentialQueue.current.then(operation, operation);
    credentialQueue.current = next.catch(() => undefined);
    return next;
  }, []);

  const restoreSession = useMemo(() => singleFlight(async () => {
    const started = generation.current;
    const isCurrent = () => started === generation.current;
    if (stateRef.current.status !== 'signedIn') setState((current) => ({ ...current, status: 'restoring' }));
    let token: string | null;
    try { token = await credentialOperation(() => store.readRefreshToken()); }
    catch (error) {
      if (!isCurrent()) return;
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
      throw error;
    }
    if (!isCurrent()) return;
    if (!token) { setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false }); return; }
    let response;
    try { response = await nativeAuthApi.refresh(token); }
    catch (error) {
      if (!isCurrent()) return;
      const rejected = error instanceof ApiError && error.status === 401;
      if (rejected) await credentialOperation(() => isCurrent() ? store.deleteRefreshToken() : Promise.resolve()).catch(() => undefined);
      if (!isCurrent()) return;
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: !rejected });
      throw error;
    }
    if (!isCurrent()) { await nativeAuthApi.logout(response.refreshToken).catch(() => undefined); return; }
    try { await credentialOperation(async () => { if (isCurrent()) await store.writeRefreshToken(response.refreshToken); }); }
    catch {
      if (!isCurrent()) return;
      await credentialOperation(() => isCurrent() ? store.deleteRefreshToken() : Promise.resolve()).catch(() => undefined);
      if (!isCurrent()) return;
      setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
      throw new Error('Secure credential storage is unavailable. Sign in again.');
    }
    if (!isCurrent()) { await nativeAuthApi.logout(response.refreshToken).catch(() => undefined); return; }
    setState({ status: 'signedIn', accessToken: response.accessToken, user: response.user, restorationPending: false, expiresAt: Date.now() + response.expiresIn * 1000 });
  }), [store, credentialOperation]);

  useEffect(() => { void restoreSession().catch(() => undefined); }, [restoreSession]);

  const login = useCallback(async (input: LoginRequest) => {
    const started = ++generation.current;
    const isCurrent = () => started === generation.current;
    const response = await nativeAuthApi.login(input);
    if (!isCurrent()) { await nativeAuthApi.logout(response.refreshToken).catch(() => undefined); return; }
    try { await credentialOperation(async () => { if (isCurrent()) await store.writeRefreshToken(response.refreshToken); }); }
    catch { if (!isCurrent()) return; await nativeAuthApi.logout(response.refreshToken).catch(() => undefined); setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false }); throw new Error('Secure credential storage is unavailable. Sign-in was not retained.'); }
    if (!isCurrent()) { await nativeAuthApi.logout(response.refreshToken).catch(() => undefined); return; }
    setState({ status: 'signedIn', accessToken: response.accessToken, user: response.user, restorationPending: false, expiresAt: Date.now() + response.expiresIn * 1000 });
  }, [store, credentialOperation]);

  const signOutLocal = useCallback(async () => {
    generation.current += 1;
    setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
    await credentialOperation(() => store.deleteRefreshToken());
  }, [store, credentialOperation]);

  const updateUser = useCallback((user: AuthUser) => { setState((current) => current.status === 'signedIn' ? { ...current, user } : current); }, []);

  const signOut = useCallback(async () => {
    generation.current += 1;
    const accessToken = stateRef.current.accessToken ?? undefined;
    setState({ status: 'signedOut', accessToken: null, user: null, restorationPending: false });
    const refreshToken = await credentialOperation(async () => {
      const token = await store.readRefreshToken().catch(() => null);
      await store.deleteRefreshToken();
      return token;
    });
    await nativeAuthApi.logout(refreshToken ?? undefined, accessToken);
  }, [store, credentialOperation]);

  useEffect(() => {
    if (state.status !== 'signedIn' || !state.expiresAt) return;
    const renew = () => {
      if (stateRef.current.status === 'signedIn' && Date.now() >= (stateRef.current.expiresAt ?? 0) - 60_000) {
        void restoreSession().catch(() => undefined);
      }
    };
    const timer = setTimeout(renew, Math.max(0, state.expiresAt - Date.now() - 60_000));
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') renew(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [state.status, state.expiresAt, restoreSession]);

  const value = useMemo(() => ({ ...state, login, restoreSession, updateUser, signOut, signOutLocal }), [state, login, restoreSession, updateUser, signOut, signOutLocal]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
