import { VerificationCode } from '../../src/components/auth/VerificationCode';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ApiError, nativeAuthApi } from '../../src/auth/api';
import { AuthFrame, authStyles } from '../../src/components/auth/AuthFrame';

export default function VerifyScreen() {
  const { email = '', linkError } = useLocalSearchParams<{ email?: string; linkError?: string }>(); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(linkError === 'true' ? 'That verification link is invalid or expired. Enter the code from your email.' : ''); const [error, setError] = useState('');
  const verify = async () => { setBusy(true); setError(''); try { await nativeAuthApi.verifyCode(email, code); router.replace({ pathname: '/(auth)/login', params: { verified: 'true' } }); } catch (value) { setError(value instanceof ApiError ? value.message : 'Verification failed.'); } finally { setBusy(false); } };
  const resend = async () => { setBusy(true); setError(''); try { await nativeAuthApi.resendVerification(email); setMessage('If the account can be verified, a new message has been sent.'); } catch (value) { setError(value instanceof ApiError ? value.message : 'The code could not be resent.'); } finally { setBusy(false); } };
  return <AuthFrame title="Verify your email" description={`Enter the six-digit code sent to ${email || 'your email address'}. The code expires in 10 minutes.`}>
    {message ? <Text style={authStyles.notice} accessibilityLiveRegion="polite">{message}</Text> : null}{error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <VerificationCode value={code} onChange={setCode} disabled={busy} onSubmit={() => void verify()} /><Text style={authStyles.notice}>5 attempts maximum before a temporary lock.</Text>
    <Pressable style={[authStyles.button, (busy || code.length !== 6) && authStyles.buttonDisabled]} onPress={() => void verify()} disabled={busy || code.length !== 6} accessibilityRole="button" accessibilityState={{ disabled: busy || code.length !== 6, busy }}><Text style={authStyles.buttonText}>{busy ? 'Checking…' : 'Verify email'}</Text></Pressable>
    <Pressable style={authStyles.link} onPress={() => void resend()} disabled={busy || !email} accessibilityRole="button"><Text style={authStyles.linkText}>Didn’t receive it? Resend code</Text></Pressable>
    <Text style={authStyles.notice}>You can also use the secure link in the same email. Using either method invalidates both.</Text>
    <Pressable style={authStyles.link} onPress={() => router.replace('/(auth)/login')} accessibilityRole="button"><Text style={authStyles.linkText}>Back to sign in</Text></Pressable>
  </AuthFrame>;
}
