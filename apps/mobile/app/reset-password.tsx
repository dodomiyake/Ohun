import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { nativeAuthApi } from '../src/auth/api';
import { AuthFrame, authStyles } from '../src/components/auth/AuthFrame';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = useRef<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof params.token !== 'string' || token.current) return;
    token.current = params.token;
    router.setParams({ token: '' });
  }, [params.token]);

  const submit = async () => {
    if (!token.current) { setError('This reset link is invalid or incomplete.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await nativeAuthApi.confirmPasswordReset(token.current, password); token.current = null; router.replace('/(auth)/login'); }
    catch (value) { setError(value instanceof Error ? value.message : 'The password could not be reset.'); }
    finally { setBusy(false); }
  };

  return <AuthFrame title="Choose a new password" description="Use at least 15 characters. Spaces and Unicode are allowed.">
    {error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text style={authStyles.label}>New password</Text>
    <TextInput style={authStyles.input} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="new-password" accessibilityLabel="New password" />
    <Text style={authStyles.label}>Confirm new password</Text>
    <TextInput style={authStyles.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoComplete="new-password" accessibilityLabel="Confirm new password" onSubmitEditing={() => void submit()} />
    <Pressable style={authStyles.link} onPress={() => setShow((value) => !value)} accessibilityRole="button"><Text style={authStyles.linkText}>{show ? 'Hide passwords' : 'Show passwords'}</Text></Pressable>
    <Pressable style={[authStyles.button, busy ? authStyles.buttonDisabled : null]} onPress={() => void submit()} disabled={busy || password.length < 15 || !confirm} accessibilityRole="button" accessibilityState={{ disabled: busy || password.length < 15 || !confirm, busy }}><Text style={authStyles.buttonText}>{busy ? 'Resetting…' : 'Reset password'}</Text></Pressable>
  </AuthFrame>;
}
