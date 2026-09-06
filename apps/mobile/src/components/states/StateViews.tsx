import { colors, radii, spacing } from '@ohun/design-tokens';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function Frame({
  title,
  body,
  action,
  tone = 'default',
}: {
  title: string;
  body: string;
  action: string;
  tone?: 'default' | 'error' | 'offline';
}) {
  return (
    <View style={styles.state} accessibilityRole="summary">
      <View
        style={[
          styles.icon,
          tone === 'error' && styles.iconError,
          tone === 'offline' && styles.iconOffline,
        ]}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable style={styles.action} accessibilityRole="button" accessibilityState={{ disabled: true }} disabled>
        <Text style={styles.actionText}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.title}>Loading</Text>
      <Text style={styles.body}>Preparing your Ohun workspace.</Text>
    </View>
  );
}

export function EmptyState() {
  return (
    <Frame
      title="No conversations yet"
      body="When you connect with friends and family, your chats will appear here."
      action="Find people"
    />
  );
}

export function OfflineState() {
  return (
    <Frame
      title="You are offline"
      body="Check your connection. Ohun will reconnect when the network is available."
      action="Try again"
      tone="offline"
    />
  );
}

export function ErrorState() {
  return (
    <Frame
      title="Something went wrong"
      body="We could not load this screen. Please try again in a moment."
      action="Retry"
      tone="error"
    />
  );
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondaryContainer,
  },
  iconError: { backgroundColor: colors.errorContainer },
  iconOffline: { backgroundColor: colors.surfaceContainerHigh },
  title: { fontSize: 20, fontWeight: '600', color: colors.onSurface, textAlign: 'center' },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  action: {
    minHeight: spacing.touchTarget,
    minWidth: spacing.touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.onPrimary, fontWeight: '600' },
});
