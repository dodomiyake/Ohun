// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IndexScreen from '../../app/index';
const state = vi.hoisted(() => ({ auth: { status: 'signedIn', user: { id: 'user' }, accessToken: 'access' }, query: { isPending: false, isError: false, data: { profile: null as null | { displayName: string } } } }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.query }));
vi.mock('expo-router', () => ({ Redirect: ({ href }: { href: string }) => href }));
vi.mock('react-native', () => ({ View: 'div', Text: 'span', Pressable: 'button', ActivityIndicator: 'progress', StyleSheet: { create: (styles: unknown) => styles } }));
afterEach(() => { state.auth.status = 'signedIn'; state.query.isPending = false; state.query.data.profile = null; });
describe('startup navigation', () => {
  async function render() {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const element = document.createElement('div'); const root = createRoot(element);
    await act(async () => root.render(createElement(IndexScreen)));
    const text = element.textContent;
    await act(async () => root.unmount());
    return text;
  }
  it('sends accounts without a profile to profile creation', async () => { expect(await render()).toBe('/(app)/profile'); });
  it('sends returning accounts with profiles to chats', async () => { state.query.data.profile = { displayName: 'Person' }; expect(await render()).toBe('/(app)'); });
  it('sends signed-out accounts to login', async () => { state.auth.status = 'signedOut'; expect(await render()).toBe('/(auth)/login'); });
});
