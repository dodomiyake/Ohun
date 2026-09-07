import { colors, radii, spacing } from '@ohun/design-tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';

export default function SettingsScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try { await auth.signOut(); router.replace('/(auth)/login'); }
    catch { router.replace({ pathname: '/(auth)/login', params: { logoutPending: 'true' } }); }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Settings</Text></View>
    <View style={styles.content}>
      <Text style={styles.account}>{auth.user?.username}</Text>
      <Text style={styles.description}>Manage this device’s Ohun session.</Text>
      <Pressable style={[styles.button, busy ? styles.disabled : null]} disabled={busy} onPress={() => void signOut()} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}>
        <Text style={styles.buttonText}>{busy ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.md },
  account: { color: colors.onSurface, fontSize: 18, fontWeight: '600' },
  description: { color: colors.onSurfaceVariant, fontSize: 16 },
  button: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.error, paddingHorizontal: spacing.lg },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.onError, fontSize: 16, fontWeight: '700' },
});
