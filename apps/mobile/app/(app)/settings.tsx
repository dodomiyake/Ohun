import { colors, spacing, typography } from '@ohun/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { downloadAvatar, nativeProfileApi } from '../../src/profile/api';
const glyphs = { person: '\ue7fd', lock: '\ue897', notifications: '\ue7f4', palette: '\ue40a', devices: '\ue1b1', help: '\ue887', chevron: '\ue5cc', logout: '\ue9ba', chat: '\ue0b7', group: '\ue7ef', settings: '\ue8b8' };
function SettingRow({ title, icon, ready, onPress }: { title: string; icon: keyof typeof glyphs; ready: boolean; onPress?: () => void }) {
  return <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityState={{ disabled: !onPress }}>
    {ready ? <Text style={styles.icon} accessible={false}>{glyphs[icon]}</Text> : null}<View style={styles.rowLabel}><Text style={styles.rowTitle}>{title}</Text>{!onPress ? <Text style={styles.caption}>Coming soon</Text> : null}</View>{ready && onPress ? <Text style={styles.chevron} accessible={false}>{glyphs.chevron}</Text> : null}
  </Pressable>;
}
export default function SettingsScreen() {
  const auth = useAuth();
  const [ready] = useFonts({ MaterialSymbols: require('../../assets/settings/MaterialSymbols.ttf') });
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const token = auth.accessToken;
  const profile = useQuery({ queryKey: ['settings-profile', auth.user?.id], gcTime: 0, enabled: Boolean(token), queryFn: () => nativeProfileApi.read(token!) });
  const avatarKey = profile.data?.profile?.avatarKey;
  useEffect(() => {
    setPhoto(null);
    if (!avatarKey || !token) return;
    const controller = new AbortController(); let dispose: (() => void) | undefined;
    void downloadAvatar(token, controller.signal).then(result => { if (controller.signal.aborted) { result.dispose(); return; } dispose = result.dispose; setPhoto(result.uri); }).catch(() => undefined);
    return () => { controller.abort(); dispose?.(); };
  }, [avatarKey, token]);
  const name = profile.data?.profile?.displayName ?? auth.user?.username ?? 'Your profile';
  const signOut = async () => {
    setBusy(true);
    try { await auth.signOut(); router.replace('/(auth)/login'); }
    catch { router.replace({ pathname: '/(auth)/login', params: { logoutPending: 'true' } }); }
  };
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Text style={styles.brand}>Ohun</Text><Text accessibilityRole="header" style={styles.description}>Settings</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        {photo ? <Image source={{ uri: photo }} style={styles.avatar} onError={() => setPhoto(null)} accessibilityLabel="Your profile photo" /> : <View style={[styles.avatar, styles.initials]}><Text style={styles.initialText}>{name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</Text></View>}
        <View style={styles.identity}><Text style={styles.name}>{name}</Text><Text style={styles.description}>@{auth.user?.username}</Text></View>
        {profile.error ? <Pressable accessibilityRole="button" onPress={() => void profile.refetch()} style={styles.edit}><Text style={styles.description}>Retry loading profile</Text></Pressable> : null}
        <Pressable style={styles.edit} onPress={() => router.push('/(app)/profile')} accessibilityRole="button"><Text style={styles.rowTitle}>Edit profile</Text></Pressable>
      </View>
      <View style={styles.group}><Text style={styles.description}>General</Text><View style={styles.rows}>
        <SettingRow ready={ready} title="Account details" icon="person" onPress={() => router.push('/(app)/profile')} />
        <SettingRow ready={ready} title="Privacy & safety" icon="lock" />
        <SettingRow ready={ready} title="Notifications" icon="notifications" />
        <SettingRow ready={ready} title="Appearance & accessibility" icon="palette" />
      </View></View>
      <View style={styles.group}><Text style={styles.description}>Advanced</Text><View style={styles.rows}>
        <SettingRow ready={ready} title="Active devices" icon="devices" onPress={() => router.push('/(app)/devices')} />
        <SettingRow ready={ready} title="Help center" icon="help" />
      </View></View>
      <Pressable style={styles.logout} disabled={busy} onPress={() => void signOut()} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}><Text style={styles.logoutText}>{busy ? 'Signing out…' : 'Sign out'}</Text>{ready ? <Text style={[styles.icon, { color: colors.error }]} accessible={false}>{glyphs.logout}</Text> : null}</Pressable>
      <Text style={styles.footer}>Ohun</Text>
    </ScrollView>
    <View style={styles.nav} accessibilityRole="tablist">
      <Pressable style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={() => router.replace('/(app)')}><>{ready ? <Text style={styles.icon} accessible={false}>{glyphs.chat}</Text> : null}<Text style={styles.caption}>Chats</Text></></Pressable>
      <View style={styles.tab} accessibilityLabel="People, coming soon"><>{ready ? <Text style={styles.icon} accessible={false}>{glyphs.group}</Text> : null}<Text style={styles.caption}>People · Soon</Text></></View>
      <View style={[styles.tab, styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: true }}><>{ready ? <Text style={[styles.icon, { color: colors.onPrimary }]} accessible={false}>{glyphs.settings}</Text> : null}<Text style={styles.activeText}>Settings</Text></></View>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }, brand: { fontFamily: typography.fontFamilyBrandNative, color: colors.primary, fontSize: 24 },
  content: { padding: 16, gap: 28, maxWidth: 528, width: '100%', alignSelf: 'center' }, profileCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: '#edeef3', padding: 24, gap: 20, alignItems: 'center' }, avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: '#d6ddf7' }, initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }, initialText: { fontSize: 28, color: colors.primary, fontWeight: '700' }, identity: { gap: 4, alignItems: 'center' }, name: { fontSize: 28, color: colors.onSurface, fontWeight: '700', textAlign: 'center' }, description: { fontSize: 14, color: colors.onSurfaceVariant }, edit: { minHeight: spacing.touchTarget, borderWidth: 1, borderColor: colors.outline, borderRadius: 24, paddingHorizontal: 20, justifyContent: 'center' }, group: { gap: 8 }, rows: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#edeef3', borderRadius: 12, overflow: 'hidden' }, row: { minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#edeef3' }, rowLabel: { flex: 1, gap: 4 }, rowTitle: { color: colors.onSurface, fontSize: 16 }, icon: { width: 24, height: 24, fontSize: 24, fontFamily: 'MaterialSymbols', color: colors.primary }, chevron: { width: 24, height: 24, fontSize: 24, fontFamily: 'MaterialSymbols', color: colors.outline }, caption: { color: colors.onSurfaceVariant, fontSize: 12 }, logout: { minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.errorContainer, backgroundColor: '#f8e8e8', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, logoutText: { fontSize: 16, color: colors.error }, footer: { color: colors.onSurfaceVariant, fontSize: 12, textAlign: 'center', padding: 20 }, nav: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, borderTopWidth: 1, borderTopColor: colors.outlineVariant }, tab: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', gap: 4 }, activeTab: { backgroundColor: colors.primary, borderRadius: 24 }, activeText: { color: colors.onPrimary, fontSize: 12 },
});
