// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PeopleScreen from './PeopleScreen';
const api = vi.hoisted(() => ({ preferences: vi.fn(), setPreferences: vi.fn(), contacts: vi.fn(), invitations: vi.fn(), search: vi.fn(), invite: vi.fn(), action: vi.fn() }));
vi.mock('./api', () => ({ peopleApi: api }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ accessToken: 'test', user: { id: 'me', username: 'alice' }, signOutLocal: vi.fn() }) }));
vi.mock('../shells/AppNav', () => ({ AppNav: () => <div>Navigation</div> }));
vi.mock('expo-router', () => ({ useFocusEffect: () => undefined, router: { replace: vi.fn() } }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (v: unknown) => v },
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Pressable: ({ children, onPress, disabled }: React.PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>) => <button disabled={disabled} onClick={onPress}>{children}</button>,
  Switch: ({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled: boolean }) => <input type="checkbox" checked={value} disabled={disabled} onChange={() => onValueChange(!value)} />,
  TextInput: ({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) => <input value={value} onInput={e => onChangeText(e.currentTarget.value)} />,
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
let root: Root; let host: HTMLDivElement; let client: QueryClient;
const person = { id: '507f1f77bcf86cd799439011', username: 'bobby', displayName: 'Bobby' };
beforeEach(() => {
  vi.clearAllMocks(); api.preferences.mockResolvedValue({ byUsername: false }); api.contacts.mockResolvedValue({ people: [], nextCursor: null }); api.invitations.mockResolvedValue({ invitations: [], nextCursor: null }); api.setPreferences.mockResolvedValue({ byUsername: true }); api.invite.mockResolvedValue({ ok: true }); api.action.mockResolvedValue({ ok: true });
});
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); client?.clear(); });
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function mount(requests = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><PeopleScreen requests={requests} /></QueryClientProvider>)); await settle();
}
async function click(label: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === label); expect(button).toBeDefined(); await act(async () => button!.click()); await settle(); }
it.each(['bobby', '@bobby', ' @bobby '])('searches %s with discovery off until opt-in', async (typedUsername) => {
  api.search.mockResolvedValue({ people: [person], nextCursor: null }); await mount();
  expect((host.querySelector('[type=checkbox]') as HTMLInputElement).checked).toBe(false);
  await act(async () => (host.querySelector('[type=checkbox]') as HTMLInputElement).click());
  expect(api.setPreferences).toHaveBeenCalledWith('test', true);
  const input = host.querySelector('input:not([type=checkbox])') as HTMLInputElement;
  await act(async () => { input.value = typedUsername; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('Search'); expect(api.search).toHaveBeenCalledWith('test', 'bobby'); expect(host.textContent).toContain('@bobby');
  await click('Send request'); expect(api.invite).toHaveBeenCalledWith('test', person.id);
});
it('shows accept and ignore for incoming requests and only cancel for outgoing', async () => {
  api.invitations.mockResolvedValue({ invitations: [{ id: 'incoming', person, direction: 'incoming', createdAt: '2026-10-11T00:00:00Z' }, { id: 'outgoing', person: { ...person, id: 'other' }, direction: 'outgoing', createdAt: '2026-10-11T00:00:00Z' }], nextCursor: null });
  await mount(true); await click('Accept'); expect(api.action).toHaveBeenCalledWith('test', 'incoming', 'accept');
  await click('Ignore'); expect(api.action).toHaveBeenCalledWith('test', 'incoming', 'ignore');
  await click('Cancel'); expect(api.action).toHaveBeenCalledWith('test', 'outgoing', 'cancel');
});
it('renders request errors with retry instead of an empty success state', async () => {
  api.invitations.mockRejectedValue(new Error('Connection unavailable')); await mount(true);
  expect(host.textContent).toContain('Connection unavailable'); expect(host.textContent).not.toContain('No incoming requests');
  api.invitations.mockResolvedValue({ invitations: [], nextCursor: null }); await click('Retry'); expect(host.textContent).toContain('No incoming requests');
});
it('shows sending and failure next to the recipient and allows a retry', async () => {
  let rejectInvite!: (error: Error) => void;
  api.invite.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectInvite = reject; }));
  api.search.mockResolvedValue({ people: [person], nextCursor: null });
  await mount();
  const input = host.querySelector('input:not([type=checkbox])') as HTMLInputElement;
  await act(async () => { input.value = 'bobby'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('Search'); await click('Send request');
  const sending = [...host.querySelectorAll('button')].find(b => b.textContent === 'Sending request…');
  expect(sending?.disabled).toBe(true);
  await act(async () => rejectInvite(new Error('Ohun did not respond. Please try again.'))); await settle();
  const send = [...host.querySelectorAll('button')].find(b => b.textContent === 'Send request')!;
  expect(send.disabled).toBe(false);
  expect(send.parentElement?.textContent).toContain('Ohun did not respond. Please try again.');
  await click('Send request');
  expect(send.parentElement?.textContent).toContain('Request submitted. Open Contact requests to check its status.');
});
