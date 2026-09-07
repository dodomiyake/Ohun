import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { ApiError, nativeAuthApi } from '../../src/auth/api';
import { AuthFrame, authStyles } from '../../src/components/auth/AuthFrame';

export default function VerifyScreen() {
  const { email = '', linkError } = useLocalSearchParams<{ email?: string; linkError?: string }>(); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(linkError === 'true' ? 'That verification link is invalid or expired. Enter the code from your email.' : ''); const [error, setError] = useState('');
  const verify = async () => { setBusy(true); setError(''); try { await nativeAuthApi.verifyCode(email, code); router.replace({ pathname: '/(auth)/login', params: { verified: 'true' } }); } catch (value) { setError(value instanceof ApiError ? value.message : 'Verification failed.'); } finally { setBusy(false); } };
  const resend = async () => { setBusy(true); setError(''); try { await nativeAuthApi.resendVerification(email); setMessage('If the account can be verified, a new message has been sent.'); } catch (value) { setError(value instanceof ApiError ? value.message : 'The code could not be resent.'); } finally { setBusy(false); } };
  return <AuthFrame title="Check your email" description={`Enter the six-digit code sent to ${email || 'your email address'}.`}>
    {message ? <Text style={authStyles.notice} accessibilityLiveRegion="polite">{message}</Text> : null}{error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text style={authStyles.label}>Verification code</Text><TextInput style={authStyles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} accessibilityLabel="Six-digit verification code" onSubmitEditing={() => void verify()} />
    <Pressable style={[authStyles.button, (busy || code.length !== 6) && authStyles.buttonDisabled]} onPress={() => void verify()} disabled={busy || code.length !== 6} accessibilityRole="button" accessibilityState={{ disabled: busy || code.length !== 6, busy }}><Text style={authStyles.buttonText}>{busy ? 'Checking…' : 'Verify email'}</Text></Pressable>
    <Pressable style={authStyles.link} onPress={() => void resend()} disabled={busy || !email} accessibilityRole="button"><Text style={authStyles.linkText}>Send a new code</Text></Pressable>
    <Pressable style={authStyles.link} onPress={() => router.replace('/(auth)/login')} accessibilityRole="button"><Text style={authStyles.linkText}>Back to sign in</Text></Pressable>
  </AuthFrame>;
}
