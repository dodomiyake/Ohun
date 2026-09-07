import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { nativeAuthApi, ApiError } from '../../src/auth/api';
import { AuthFrame, authStyles } from '../../src/components/auth/AuthFrame';

export default function RegisterScreen() {
  const [email, setEmail] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async () => { if (password !== confirm) { setError('Passwords do not match.'); return; } setBusy(true); setError(''); try { await nativeAuthApi.register({ email, username, password }); router.replace({ pathname: '/(auth)/verify', params: { email } }); } catch (value) { setError(value instanceof ApiError ? value.message : 'Registration failed.'); } finally { setBusy(false); } };
  const disabled = busy || !email || !username || Array.from(password).length < 15 || !confirm;
  return <AuthFrame title="Create your account" description="Join Ohun to talk privately with friends and family.">
    {error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text style={authStyles.label}>Email</Text><TextInput style={authStyles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" accessibilityLabel="Email" />
    <Text style={authStyles.label}>Username</Text><TextInput style={authStyles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" accessibilityLabel="Username" />
    <Text style={authStyles.label}>Password</Text><TextInput style={authStyles.input} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="new-password" accessibilityLabel="Password" /><Text style={authStyles.notice}>Use 15–128 characters. Spaces and Unicode are allowed.</Text>
    <Text style={authStyles.label}>Confirm password</Text><TextInput style={authStyles.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoComplete="new-password" accessibilityLabel="Confirm password" onSubmitEditing={() => void submit()} />
    <Pressable style={authStyles.link} onPress={() => setShow((value) => !value)} accessibilityRole="button"><Text style={authStyles.linkText}>{show ? 'Hide passwords' : 'Show passwords'}</Text></Pressable>
    <Pressable style={[authStyles.button, disabled && authStyles.buttonDisabled]} onPress={() => void submit()} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, busy }}><Text style={authStyles.buttonText}>{busy ? 'Creating account…' : 'Create account'}</Text></Pressable>
    <Link href="/(auth)/login" asChild><Pressable style={authStyles.link} accessibilityRole="link"><Text style={authStyles.linkText}>Already have an account? Sign in</Text></Pressable></Link>
  </AuthFrame>;
}
