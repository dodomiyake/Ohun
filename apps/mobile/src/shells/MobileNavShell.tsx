import { colors } from '@ohun/design-tokens';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppNav } from './AppNav';
export function MobileNavShell() {
  return <View style={s.layout}><Text accessibilityRole="header" style={s.title}>Chats</Text><View style={s.content}><Text style={s.heading}>Your conversations will appear here</Text><Text style={s.caption}>Messaging is not available yet. You can now find people and manage contact requests.</Text><Pressable accessibilityRole="button" style={s.button} onPress={() => router.replace('/(app)/people')}><Text style={s.link}>Find people</Text></Pressable></View><AppNav active="Chats" /></View>;
}
const s = StyleSheet.create({ layout: { flex: 1, backgroundColor: colors.background }, title: { fontSize: 24, fontWeight: '700', padding: 24, color: colors.onSurface }, content: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' }, heading: { fontSize: 22, fontWeight: '600', color: colors.onSurface }, caption: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant }, button: { minHeight: 48, justifyContent: 'center' }, link: { color: colors.primary, fontSize: 16 } });
