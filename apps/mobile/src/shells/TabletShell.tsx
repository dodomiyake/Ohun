import { colors, radii, spacing } from '@ohun/design-tokens';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export function TabletShell() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <View style={[styles.layout, isTablet && styles.layoutTablet]}>
      <View style={[styles.sidebar, isTablet && styles.sidebarTablet]}>
        <Text style={styles.title}>Chats</Text>
        {['Alex', 'Jordan', 'Sam'].map((name) => (
          <View key={name} style={styles.row}>
            <View style={styles.avatar} />
            <Text style={styles.name}>{name}</Text>
          </View>
        ))}
      </View>
      <View style={styles.panel} accessibilityLabel="Conversation panel">
        <Text style={styles.title}>Conversation</Text>
        <Text style={styles.body}>
          Tablet layout adapts from a stacked mobile view to a two-column shell.
        </Text>
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, backgroundColor: colors.background },
  layoutTablet: { flexDirection: 'row' },
  sidebar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  sidebarTablet: {
    width: 280,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
  },
  panel: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '600', color: colors.onSurface, marginBottom: spacing.md },
  body: { fontSize: 16, color: colors.onSurfaceVariant, lineHeight: 24 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondaryContainer,
  },
  name: { color: colors.onSurface, fontWeight: '500' },
  placeholder: {
    height: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
  },
});
