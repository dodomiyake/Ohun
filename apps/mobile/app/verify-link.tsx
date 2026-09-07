import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@ohun/design-tokens';
import { nativeAuthApi } from '../src/auth/api';

export default function VerifyLinkScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>(); const [rawToken] = useState(() => token ?? ''); const exchanged = useRef(false);
  useEffect(() => { if (!rawToken || exchanged.current) return; exchanged.current = true; router.setParams({ token: '' }); void nativeAuthApi.verifyLink(rawToken).then(() => router.replace({ pathname: '/(auth)/login', params: { verified: 'true' } })).catch(() => router.replace({ pathname: '/(auth)/login', params: { linkError: 'true' } })); }, [rawToken]);
  if (!rawToken) return <Redirect href="/(auth)/login" />;
  return <View style={styles.page} accessibilityRole="progressbar" accessibilityLabel="Verifying email"><ActivityIndicator color={colors.primary} /><Text style={styles.text}>Verifying your email…</Text></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background }, text: { color: colors.onSurface } });
