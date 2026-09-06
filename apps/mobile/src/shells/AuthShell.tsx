import { colors, radii, spacing, typography } from '@ohun/design-tokens';
import { StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { sharedStyles } from '../theme';

/** Static authentication shell — no auth logic in M1. */
export function AuthShell() {
  return (
    <View style={styles.page} accessibilityLabel="Authentication shell">
      <View style={styles.card}>
        <Image
          source={require('../../assets/brand/ohun-icon-light-192.png')}
          style={styles.logo}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <Text style={[sharedStyles.title, styles.brand]}>Ohun</Text>
        <Text style={sharedStyles.body}>
          Sign in to continue private conversations with friends and family.
        </Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          editable={false}
          placeholder="you@example.com"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Email"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          editable={false}
          secureTextEntry
          placeholder="Enter your password"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Password"
        />
        <View style={[styles.button, sharedStyles.touchTarget]} accessibilityRole="button" accessibilityState={{ disabled: true }}>
          <Text style={styles.buttonText}>Sign in</Text>
        </View>
        <Text style={styles.note}>Authentication is deferred to a later milestone.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  logo: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  brand: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    // Weight is baked into Nunito_800ExtraBold; do not set fontWeight on native.
    fontFamily: typography.fontFamilyBrandNative,
  },
  label: {
    marginTop: spacing.md,
    fontWeight: '600',
    color: colors.onSurface,
  },
  input: {
    minHeight: spacing.touchTarget,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  note: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
