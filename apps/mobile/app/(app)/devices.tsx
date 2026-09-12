import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radii, spacing } from '@ohun/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { ApiError } from '../../src/auth/api';
import { nativeSessionsApi } from '../../src/sessions/api';

export default function DevicesScreen() {
  const auth = useAuth();
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  const queryKey = ['active-devices', auth.user?.id];
  const devices = useQuery({ queryKey, enabled: Boolean(auth.accessToken), gcTime: 0,
    queryFn: ({ signal }) => nativeSessionsApi.list(auth.accessToken!, signal), staleTime: 0 });
  const revoke = useMutation({
    mutationFn: (id: string | null) => id ? nativeSessionsApi.revoke(auth.accessToken!, id) : nativeSessionsApi.revokeOthers(auth.accessToken!),
    onSuccess: async (_response, id) => {
      const current = devices.data?.sessions.find((session) => session.id === id)?.current;
      if (current) { client.removeQueries({ queryKey }); await auth.signOutLocal(); return; }
      setNotice(id ? 'Device logged out.' : 'All other devices logged out.');
      await client.invalidateQueries({ queryKey });
    },
  });
  const error = revoke.error ?? devices.error;
  const signOutLocal = auth.signOutLocal;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      client.removeQueries({ queryKey: ['active-devices'] });
      void signOutLocal().catch(() => undefined);
    }
  }, [error, signOutLocal, client]);
  const refetch = devices.refetch;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refetch(); });
    return () => subscription.remove();
  }, [refetch]);
  const confirm = (id: string | null, name?: string) => {
    Alert.alert(id ? `Log out ${name}?` : 'Log out all other devices?', id ? 'You will need to sign in again on that device.' : 'This device will stay signed in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { setNotice(''); revoke.mutate(id); } },
    ]);
  };
  const sessions = devices.data?.sessions ?? [];
  const busy = revoke.isPending;
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={devices.isRefetching} onRefresh={() => void devices.refetch()} />}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" style={styles.button} onPress={() => router.back()}><Text style={styles.link}>Back</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Active devices</Text>
      <Text style={styles.description}>Review where you’re signed in to Ohun. Activity times are approximate.</Text>
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text> : null}
      {error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error.message}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => { revoke.reset(); void devices.refetch(); }}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
      {devices.isPending ? <ActivityIndicator accessibilityLabel="Loading active devices" color={colors.primary} /> : null}
      {!devices.isPending && !devices.error && sessions.length === 0 ? <Text style={styles.description}>No active devices found. Pull down to refresh.</Text> : null}
      {sessions.map((session) => <View key={session.id} style={styles.card}>
        <Text style={styles.name}>{session.deviceName}</Text>
        <Text style={styles.description}>{session.current ? 'This device' : session.platform === 'native' ? 'Mobile app' : 'Web browser'}</Text>
        <Text style={styles.description}>Last active: {new Date(session.lastUsedAt).toLocaleString()}</Text>
        <Text style={styles.description}>Signed in: {new Date(session.createdAt).toLocaleString()}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Log out ${session.current ? 'this device' : session.deviceName}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} style={styles.button} onPress={() => confirm(session.id, session.deviceName)}><Text style={styles.error}>Log out</Text></Pressable>
      </View>)}
      {sessions.some((session) => !session.current) ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} style={styles.button} onPress={() => confirm(null)}><Text style={styles.error}>{busy ? 'Logging out…' : 'Log out all other devices'}</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.onSurface }, description: { fontSize: 16, color: colors.onSurfaceVariant },
  card: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.outlineVariant },
  name: { fontSize: 18, fontWeight: '700', color: colors.onSurface }, button: { minHeight: spacing.touchTarget, justifyContent: 'center', paddingVertical: spacing.sm },
  link: { fontSize: 16, color: colors.primary, fontWeight: '700' }, error: { fontSize: 16, color: colors.error, fontWeight: '600' },
});
