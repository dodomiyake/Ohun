// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificationCode } from '../components/auth/VerificationCode';
import ProfileScreen from '../../app/(app)/profile';
const api = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), uploadAvatar: vi.fn(), picker: vi.fn() }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (v: unknown) => v },
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Image: ({ source }: { source: { uri: string } }) => <img src={source.uri} />,
  ActivityIndicator: () => <progress />,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: React.PropsWithChildren<{ onPress?: () => void; disabled?: boolean; accessibilityLabel?: string }>) => <button onClick={onPress} disabled={disabled} aria-label={accessibilityLabel}>{children}</button>,
  TextInput: ({ value, onChangeText, editable, accessibilityLabel }: { value: string; onChangeText: (v: string) => void; editable?: boolean; accessibilityLabel: string }) => <input aria-label={accessibilityLabel} value={value} disabled={editable === false} onInput={e => onChangeText(e.currentTarget.value)} />,
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('expo-router', () => ({ router: { replace: vi.fn() } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ accessToken: 'test', user: { username: 'adeola' }, updateUser: vi.fn() }) }));
vi.mock('../profile/api', () => ({ nativeProfileApi: api, downloadAvatar: vi.fn().mockResolvedValue({ uri: 'file:///download.webp', dispose: vi.fn() }) }));
vi.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: async () => ({ granted: true }), launchImageLibraryAsync: api.picker }));
let root: Root; let host: HTMLDivElement;
async function mount(element: React.ReactElement) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(element); });
}
async function input(label: string, value: string) { const element = host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement; await act(async () => { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function click(text: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === text || b.getAttribute('aria-label') === text)!; await act(async () => { button.click(); }); }
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.clearAllMocks(); });
describe('revised mobile interactions', () => {
  it('accepts a pasted code and renders six visual digits through one input', async () => {
    function Code() { const [value, setValue] = useState(''); return <VerificationCode value={value} onChange={setValue} disabled={false} onSubmit={() => undefined} />; }
    await mount(<Code />); await input('Six-digit verification code', '12x34567');
    expect(host.querySelectorAll('input')).toHaveLength(1);
    expect(host.querySelector('input')?.value).toBe('123456');
    expect(host.textContent).toBe('123456');
  });
  it('disables verification entry while submission is pending', async () => {
    await mount(<VerificationCode value="123456" onChange={() => undefined} disabled onSubmit={() => undefined} />);
    expect(host.querySelector('input')?.disabled).toBe(true);
  });
  it('stages a creation photo and uploads it after profile save', async () => {
    api.read.mockResolvedValue({ profile: null }); api.picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///chosen.png' }] });
    api.update.mockResolvedValue({ user: { username: 'adeola' } }); api.uploadAvatar.mockResolvedValue({ profile: { avatarKey: 'new' } });
    await mount(<ProfileScreen />); await click('Choose profile photo');
    expect(api.uploadAvatar).not.toHaveBeenCalled();
    expect(host.querySelector('img')?.getAttribute('src')).toBe('file:///chosen.png');
    await input('Display name', 'Adeola');
    expect(host.textContent).toContain('Create your profile');
    await click('Save profile');
    expect(api.update).toHaveBeenCalled(); expect(api.uploadAvatar).toHaveBeenCalledWith('test', { uri: 'file:///chosen.png' });
    expect(api.update.mock.invocationCallOrder[0]).toBeLessThan(api.uploadAvatar.mock.invocationCallOrder[0]!);
  });
});
