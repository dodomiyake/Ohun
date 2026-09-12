import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@ohun/design-tokens';
import { useAuth } from '../src/auth/AuthProvider';
import { nativeProfileApi } from '../src/profile/api';

export default function IndexScreen() {
  const auth = useAuth();
  const profile = useQuery({
    queryKey: ['startup-profile', auth.user?.id],
    enabled: auth.status === 'signedIn', gcTime: 0, retry: false,
    queryFn: () => nativeProfileApi.read(auth.accessToken!),
  });
  if (auth.status === 'restoring' || (auth.status === 'signedIn' && profile.isPending)) {
    return <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Opening your account"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (auth.status !== 'signedIn') return <Redirect href="/(auth)/login" />;
  if (profile.isError) return <View style={styles.loading}>
    <Text accessibilityRole="alert" style={styles.message}>Your profile could not be checked. Reconnect and try again.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => void profile.refetch()}><Text style={styles.link}>Try again</Text></Pressable>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => void auth.signOut().catch(() => undefined)}><Text style={styles.link}>Sign out</Text></Pressable>
  </View>;
  return <Redirect href={profile.data?.profile ? '/(app)' : '/(app)/profile'} />;
}
const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  message: { color: colors.onSurface, fontSize: 16, textAlign: 'center' },
  button: { minHeight: spacing.touchTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  link: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
