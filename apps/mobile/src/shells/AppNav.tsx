import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@ohun/design-tokens';
const routes = { Chats: '/(app)', People: '/(app)/people', Settings: '/(app)/settings' } as const;
export function AppNav({ active }: { active: keyof typeof routes | 'Requests' }) {
  const [ready] = useFonts({ MaterialSymbols: require('../../assets/settings/MaterialSymbols.ttf') });
  const glyphs = { Chats: '\ue0b7', People: '\ue7ef', Settings: '\ue8b8' };
  const current = active === 'Requests' ? 'People' : active;
  return <View style={s.nav} accessibilityRole="tablist">{(Object.keys(routes) as Array<keyof typeof routes>).map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: current === label }} onPress={() => router.replace(routes[label])} style={[s.tab, current === label && s.active]}><>{ready ? <Text accessible={false} style={[s.icon, current === label && s.selected]}>{glyphs[label]}</Text> : null}<Text style={[s.text, current === label && s.selected]}>{label}</Text></></Pressable>)}</View>;
}
const s = StyleSheet.create({ icon: { fontFamily: 'MaterialSymbols', fontSize: 24, color: colors.onSurfaceVariant }, nav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.outlineVariant }, tab: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', gap: 4, justifyContent: 'center', borderRadius: 24 }, active: { backgroundColor: colors.primaryContainer }, text: { color: colors.onSurfaceVariant, fontSize: 12 }, selected: { color: colors.onPrimary } });
