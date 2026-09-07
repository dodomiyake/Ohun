import { colors, radii, spacing, typography } from '@ohun/design-tokens';
import type { PropsWithChildren, ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AuthFrame({ title, description, children, footer }: PropsWithChildren<{ title: string; description: string; footer?: ReactNode }>) {
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.card}>
    <Image source={require('../../../assets/brand/ohun-icon-light-192.png')} style={styles.logo} accessible={false} accessibilityIgnoresInvertColors />
    <Text style={styles.brand}>Ohun</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>
    {children}{footer}
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export const authStyles = StyleSheet.create({
  label: { color: colors.onSurface, fontWeight: '600', marginTop: spacing.sm },
  input: { minHeight: spacing.touchTarget, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radii.lg, paddingHorizontal: spacing.md, color: colors.onSurface, backgroundColor: colors.surfaceContainerLow },
  button: { minHeight: spacing.touchTarget, marginTop: spacing.md, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  buttonDisabled: { opacity: 0.55 }, buttonText: { color: colors.onPrimary, fontWeight: '700' },
  link: { minHeight: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }, linkText: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.error, lineHeight: 20 }, notice: { color: colors.onSurfaceVariant, lineHeight: 20 },
});

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm }, logo: { width: 64, height: 64, alignSelf: 'center' }, brand: { fontFamily: typography.fontFamilyBrandNative, fontSize: 32, textAlign: 'center', color: colors.onSurface }, title: { fontSize: 24, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md }, description: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant, marginBottom: spacing.sm } });
