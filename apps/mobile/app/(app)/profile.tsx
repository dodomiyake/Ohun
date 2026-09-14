import { colors, radii, spacing } from '@ohun/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { downloadAvatar, nativeProfileApi } from '../../src/profile/api';

export default function ProfileScreen() {
  const auth = useAuth();
  const token = auth.accessToken;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState(auth.user?.username ?? '');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
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
      setAvatarKey(result.profile.avatarKey ?? null); setAvatarFailed(false);
      setProfileExists(true);
      setDisplayName(result.profile.displayName); setUsername(result.user.username); setBio(result.profile.bio); setStatus(result.profile.status);
    }).catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Profile could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    setAvatarUri(null);
    if (!token || !avatarKey) return;
    let active = true;
    let dispose: (() => void) | undefined;
    const controller = new AbortController();
    void downloadAvatar(token, controller.signal).then((photo) => {
      if (!active) { photo.dispose(); return; }
      dispose = photo.dispose;
      setAvatarFailed(false); setAvatarUri(photo.uri);
    }).catch((value) => {
      if (active) setError(value instanceof Error ? value.message : 'Your photo could not be loaded.');
    });
    return () => { active = false; controller.abort(); dispose?.(); };
  }, [token, avatarKey]);

  const chooseAvatar = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow photo access to choose an avatar.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset || !token) return;
      if (!profileExists) { setPendingPhoto(asset); setAvatarFailed(false); return; }
      const uploaded = await nativeProfileApi.uploadAvatar(token, asset);
      setPendingPhoto(null); setAvatarKey(uploaded.profile?.avatarKey ?? null); setAvatarFailed(false);
    } catch (value) { setError(value instanceof Error ? value.message : 'Your photo could not be selected or uploaded. Try again.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!token) return;
    setBusy(true); setError('');
    try { const result = await nativeProfileApi.update(token, { displayName, username, bio, status }); auth.updateUser(result.user); setProfileExists(true);
      if (pendingPhoto) { const uploaded = await nativeProfileApi.uploadAvatar(token, pendingPhoto); setAvatarKey(uploaded.profile?.avatarKey ?? null); setPendingPhoto(null); }
      setSaved(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  };

  if (loading) return <SafeAreaView style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading profile"><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>{profileExists ? 'Edit profile' : 'Create your profile'}</Text>
    <Text style={styles.description}>Add the name and photo people will see in conversations.</Text>
    {saved ? <Text style={styles.notice} accessibilityLiveRegion="polite">Profile saved.</Text> : null}
    {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <Pressable style={styles.avatarButton} onPress={() => void chooseAvatar()} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose profile photo" accessibilityState={{ disabled: busy }}>
      {(pendingPhoto?.uri || avatarUri) && !avatarFailed ? <Image source={{ uri: pendingPhoto?.uri ?? avatarUri! }} onError={() => { setAvatarFailed(true); setError('Your photo downloaded, but this device could not display it. Try a different photo.'); }} style={styles.avatar} accessibilityLabel="Your profile photo" /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{displayName.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'Oh'}</Text></View>}
      <Text style={styles.photoLink}>Add profile photo</Text>
    </Pressable>
    <Text style={styles.label}>Display name</Text><TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} maxLength={80} autoComplete="name" placeholder="Your name" accessibilityLabel="Display name" />
    {profileExists ? <><Text style={styles.label}>Username</Text><TextInput style={styles.input} value={username} onChangeText={setUsername} maxLength={32} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Username" /></> : null}
    <Text style={styles.label}>Bio or status</Text><TextInput style={styles.input} value={status} onChangeText={setStatus} maxLength={160} placeholder="Available" accessibilityLabel="Status" />
    <Text style={styles.label}>About you</Text><TextInput style={[styles.input, styles.bio]} value={bio} onChangeText={setBio} maxLength={500} multiline textAlignVertical="top" placeholder="Tell people a little about yourself" accessibilityLabel="Bio" />
    <Pressable style={[styles.save, busy ? styles.disabled : null]} onPress={() => void save()} disabled={busy || !displayName.trim() || username.length < 3} accessibilityRole="button" accessibilityState={{ busy, disabled: busy || !displayName.trim() || username.length < 3 }}><Text style={styles.saveText}>{busy ? 'Saving…' : 'Save profile'}</Text></Pressable>
    {!profileExists ? <Text style={styles.photoHint}>Your username was created during registration and can be changed later in profile settings.</Text> : null}
    {profileExists ? <Pressable style={styles.continueButton} onPress={() => router.replace('/(app)')} accessibilityRole="button"><Text style={styles.continueText}>Continue to chats</Text></Pressable> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 40, gap: spacing.sm, width: '100%', maxWidth: 528, alignSelf: 'center' }, title: { color: colors.onSurface, fontSize: 28, fontWeight: '800' }, description: { color: colors.onSurfaceVariant, fontSize: 16, marginBottom: spacing.sm },
  error: { color: colors.error, backgroundColor: colors.errorContainer, borderRadius: radii.md, padding: spacing.md }, notice: { color: colors.tertiary, backgroundColor: colors.secondaryContainer, borderRadius: radii.md, padding: spacing.md }, avatarButton: { alignSelf: 'center', minWidth: 112, minHeight: 112, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32 }, avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }, avatarText: { color: colors.primary, fontWeight: '700' },
  label: { color: colors.onSurface, fontSize: 15, fontWeight: '600', marginTop: spacing.sm }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.outline, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.onSurface, paddingHorizontal: spacing.md, fontSize: 16 },
  photoLink: { color: colors.primary, fontWeight: '600', marginTop: 8 }, photoHint: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, marginTop: 12 }, bio: { minHeight: 48, paddingTop: spacing.md }, save: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primary, marginTop: spacing.md }, disabled: { opacity: 0.55 }, saveText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  continueButton: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }, continueText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
