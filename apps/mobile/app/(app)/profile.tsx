import { colors, radii, spacing } from '@ohun/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { nativeProfileApi } from '../../src/profile/api';

export default function ProfileScreen() {
  const auth = useAuth();
  const token = auth.accessToken;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState(auth.user?.username ?? '');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    nativeProfileApi.read(token).then((result) => {
      if (!active || !result.profile) return;
      setProfileExists(true);
      setDisplayName(result.profile.displayName); setUsername(result.user.username); setBio(result.profile.bio); setStatus(result.profile.status);
    }).catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Profile could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Allow photo access to choose an avatar.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset || !token || !profileExists) return;
    setBusy(true); setError('');
    try { await nativeProfileApi.uploadAvatar(token, asset); setAvatarUri(asset.uri); }
    catch (value) { setError(value instanceof Error ? value.message : 'Avatar could not be uploaded.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!token) return;
    setBusy(true); setError('');
    try { const result = await nativeProfileApi.update(token, { displayName, username, bio, status }); auth.updateUser(result.user); setProfileExists(true); setSaved(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  };

  if (loading) return <SafeAreaView style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading profile"><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>{displayName ? 'Edit profile' : 'Create profile'}</Text>
    <Text style={styles.description}>Choose how friends and family see you on Ohun.</Text>
    {saved ? <Text style={styles.notice} accessibilityLiveRegion="polite">Profile saved.</Text> : null}
    {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Pressable style={styles.avatarButton} onPress={() => void chooseAvatar()} disabled={busy || !profileExists} accessibilityRole="button" accessibilityLabel="Choose profile photo" accessibilityState={{ disabled: busy || !profileExists }}>
      {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityLabel="Selected profile photo" /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>Add photo</Text></View>}
    </Pressable>
    {!profileExists ? <Text style={styles.photoHint}>Save your profile before adding an optional photo.</Text> : null}
    <Text style={styles.label}>Display name</Text><TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} maxLength={80} autoComplete="name" accessibilityLabel="Display name" />
    <Text style={styles.label}>Username</Text><TextInput style={styles.input} value={username} onChangeText={setUsername} maxLength={32} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Username" />
    <Text style={styles.label}>Status</Text><TextInput style={styles.input} value={status} onChangeText={setStatus} maxLength={160} accessibilityLabel="Status" />
    <Text style={styles.label}>Bio</Text><TextInput style={[styles.input, styles.bio]} value={bio} onChangeText={setBio} maxLength={500} multiline textAlignVertical="top" accessibilityLabel="Bio" />
    <Pressable style={[styles.save, busy ? styles.disabled : null]} onPress={() => void save()} disabled={busy || !displayName.trim() || username.length < 3} accessibilityRole="button" accessibilityState={{ busy, disabled: busy || !displayName.trim() || username.length < 3 }}><Text style={styles.saveText}>{busy ? 'Saving…' : 'Save profile'}</Text></Pressable>
    {profileExists ? <Pressable style={styles.continueButton} onPress={() => router.replace('/(app)')} accessibilityRole="button"><Text style={styles.continueText}>Continue to chats</Text></Pressable> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm }, title: { color: colors.onSurface, fontSize: 28, fontWeight: '800' }, description: { color: colors.onSurfaceVariant, fontSize: 16, marginBottom: spacing.sm },
  error: { color: colors.error, backgroundColor: colors.errorContainer, borderRadius: radii.md, padding: spacing.md }, notice: { color: colors.tertiary, backgroundColor: colors.secondaryContainer, borderRadius: radii.md, padding: spacing.md }, avatarButton: { alignSelf: 'center', minWidth: 112, minHeight: 112, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 104, height: 104, borderRadius: 52 }, avatarPlaceholder: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }, avatarText: { color: colors.primary, fontWeight: '700' },
  label: { color: colors.onSurface, fontSize: 15, fontWeight: '600', marginTop: spacing.sm }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.outline, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.onSurface, paddingHorizontal: spacing.md, fontSize: 16 },
  photoHint: { color: colors.onSurfaceVariant, textAlign: 'center' }, bio: { minHeight: 112, paddingTop: spacing.md }, save: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.primary, marginTop: spacing.md }, disabled: { opacity: 0.55 }, saveText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  continueButton: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }, continueText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
