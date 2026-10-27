import { colors, spacing, typography } from '@ohun/design-tokens';
import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AuthFrame({ title, description, children, footer }: PropsWithChildren<{ title: string; description: string; footer?: ReactNode }>) {
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.card}>
    <Text style={styles.brand}>Nlẹ́</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>
    {children}{footer}
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export const authStyles = StyleSheet.create({
  label: { color: colors.onSurface, fontWeight: '600', marginTop: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.outline, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface },
  button: { minHeight: 48, marginTop: spacing.md, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  buttonDisabled: { opacity: 0.55 }, buttonText: { color: colors.onPrimary, fontWeight: '700' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, linkText: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.error, lineHeight: 20 }, notice: { color: colors.onSurfaceVariant, lineHeight: 20 },
});

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 8 }, brand: { fontFamily: typography.fontFamilyBrandNative, fontSize: 32, color: colors.primary, marginBottom: 12 }, title: { fontSize: 28, fontWeight: '700', color: colors.onSurface }, description: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant, marginTop: 8, marginBottom: 24 } });
