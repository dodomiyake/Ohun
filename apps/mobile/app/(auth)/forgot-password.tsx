import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { nativeAuthApi } from '../../src/auth/api';
import { AuthFrame, authStyles } from '../../src/components/auth/AuthFrame';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try { await nativeAuthApi.requestPasswordReset(email); setSent(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  };

  return <AuthFrame title="Reset your password" description="Enter the email address connected to your Ohun account.">
    {sent ? <Text style={authStyles.notice} accessibilityLiveRegion="polite">If an account exists for that email, reset instructions have been sent.</Text> : null}
    {error ? <Text style={authStyles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text style={authStyles.label}>Email address</Text>
    <TextInput style={authStyles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" accessibilityLabel="Email address" onSubmitEditing={() => void submit()} />
    <Pressable style={[authStyles.button, busy ? authStyles.buttonDisabled : null]} onPress={() => void submit()} disabled={busy || !email} accessibilityRole="button" accessibilityState={{ disabled: busy || !email, busy }}><Text style={authStyles.buttonText}>{busy ? 'Sending…' : 'Send reset instructions'}</Text></Pressable>
    <Link href="/(auth)/login" asChild><Pressable style={authStyles.link} accessibilityRole="link"><Text style={authStyles.linkText}>Back to sign in</Text></Pressable></Link>
  </AuthFrame>;
}
