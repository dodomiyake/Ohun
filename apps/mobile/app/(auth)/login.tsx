import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { ApiError } from '../../src/auth/api';
import { AuthFrame, authStyles } from '../../src/components/auth/AuthFrame';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ verified?: string; linkError?: string; logoutPending?: string }>();
  const auth = useAuth();
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async () => { setBusy(true); setError(''); try { await auth.login({ identifier, password, device: { platform: 'native', name: `${Platform.OS} device` } }); router.replace('/'); } catch (value) { setError(value instanceof ApiError || value instanceof Error ? value.message : 'Sign-in failed.'); } finally { setBusy(false); } };
  const retryRestore = async () => { setBusy(true); setError(''); try { await auth.restoreSession(); router.replace('/'); } catch (value) { setError(value instanceof Error ? value.message : 'Your session could not be restored.'); } finally { setBusy(false); } };
  return <AuthFrame title="Welcome back" description="Sign in to continue your private conversations.">
    {params.verified === 'true' ? <Text style={authStyles.notice} accessibilityLiveRegion="polite">Email verified. You can now sign in.</Text> : null}
    {params.linkError === 'true' ? <Text style={authStyles.error} accessibilityLiveRegion="polite">That verification link is invalid or expired. Request a new code from the verification screen.</Text> : null}
    {params.logoutPending === 'true' ? <Text style={authStyles.notice} accessibilityLiveRegion="polite">You are signed out on this device. The server could not be reached, so the previous session may remain listed until it expires or is revoked.</Text> : null}
    {auth.restorationPending ? <><Text style={authStyles.notice}>Your saved session could not be checked. Reconnect and try again.</Text><Pressable style={authStyles.link} onPress={() => void retryRestore()} disabled={busy} accessibilityRole="button"><Text style={authStyles.linkText}>Retry saved session</Text></Pressable></> : null}
    {error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text style={authStyles.label}>Email or username</Text><TextInput style={authStyles.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" accessibilityLabel="Email or username" returnKeyType="next" />
    <Text style={authStyles.label}>Password</Text><TextInput style={authStyles.input} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password" accessibilityLabel="Password" onSubmitEditing={() => void submit()} />
    <Pressable style={authStyles.link} onPress={() => setShow((value) => !value)} accessibilityRole="button"><Text style={authStyles.linkText}>{show ? 'Hide password' : 'Show password'}</Text></Pressable>
    <Pressable style={[authStyles.button, busy ? authStyles.buttonDisabled : null]} onPress={() => void submit()} disabled={busy || !identifier || !password} accessibilityRole="button" accessibilityState={{ disabled: busy || !identifier || !password, busy }}><Text style={authStyles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>
    <Link href="/(auth)/forgot-password" asChild><Pressable style={authStyles.link} accessibilityRole="link"><Text style={authStyles.linkText}>Forgot password?</Text></Pressable></Link>
    <Link href="/(auth)/register" asChild><Pressable style={authStyles.link} accessibilityRole="link"><Text style={authStyles.linkText}>Create an account</Text></Pressable></Link>
  </AuthFrame>;
}
