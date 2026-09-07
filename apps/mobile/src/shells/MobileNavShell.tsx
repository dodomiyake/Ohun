import { colors, radii, spacing } from '@ohun/design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const NAV = ['Chats', 'People', 'Requests', 'Settings'] as const;

export function MobileNavShell() {
  return (
    <View style={styles.layout}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      <View style={styles.content}>
        {['Alex', 'Jordan', 'Sam'].map((name) => (
          <View key={name} style={styles.row} accessibilityRole="summary">
            <View style={styles.avatar} />
            <View style={styles.meta}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.preview}>Message preview placeholder</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.bottomNav} accessibilityRole="tablist">
        {NAV.map((label, index) => (
          <Pressable
            key={label}
            style={styles.navItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: index === 0, disabled: true }}
            disabled
          >
            <View style={[styles.icon, index === 0 && styles.iconActive]} />
            <Text style={[styles.navLabel, index === 0 && styles.navLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: colors.onSurface },
  content: { flex: 1, padding: spacing.md, gap: spacing.sm },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondaryContainer,
  },
  meta: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  preview: { fontSize: 14, color: colors.onSurfaceVariant },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  navItem: {
    flex: 1,
    minHeight: spacing.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.outline,
    opacity: 0.35,
  },
  iconActive: {
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
  navLabel: { fontSize: 10, color: colors.onSurfaceVariant },
  navLabelActive: { color: colors.primary, fontWeight: '600' },
});
