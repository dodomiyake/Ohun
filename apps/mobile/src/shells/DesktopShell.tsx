import { colors, radii, spacing } from '@ohun/design-tokens';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const RAIL = ['Chats', 'People', 'Settings'] as const;

export function DesktopShell() {
  return (
    <View style={styles.layout}>
      <View style={styles.rail} accessibilityRole="tablist">
        {RAIL.map((label, index) => (
          <Pressable
            key={label}
            style={[styles.railItem, index === 0 && styles.railItemActive]}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: index === 0, disabled: true }}
            disabled
          >
            <View style={[styles.railIcon, index === 0 && styles.railIconActive]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.listPane}>
        <Text style={styles.paneTitle}>Chats</Text>
        {['Alex', 'Jordan', 'Sam'].map((name, index) => (
          <View key={name} style={[styles.chatRow, index === 0 && styles.chatRowActive]}>
            <View style={styles.avatar} />
            <View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.preview}>Preview placeholder</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.conversation}>
        <Text style={styles.paneTitle}>Alex</Text>
        <View style={styles.messages}>
          <View style={styles.bubbleIn}>
            <Text>Incoming placeholder message</Text>
          </View>
          <View style={styles.bubbleOut}>
            <Text style={styles.bubbleOutText}>Outgoing placeholder message</Text>
          </View>
        </View>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            editable={false}
            placeholder="Type a message"
            placeholderTextColor={colors.onSurfaceVariant}
            accessibilityLabel="Message"
          />
          <Pressable style={styles.send} accessibilityRole="button" accessibilityState={{ disabled: true }} disabled>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  rail: {
    width: 72,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
  },
  railItem: {
    width: spacing.touchTarget,
    height: spacing.touchTarget,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railItemActive: { backgroundColor: colors.secondaryContainer },
  railIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.outline,
    opacity: 0.45,
  },
  railIconActive: { backgroundColor: colors.primary, opacity: 0.9 },
  listPane: {
    width: 280,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
    padding: spacing.md,
  },
  conversation: { flex: 1, backgroundColor: colors.surface },
  paneTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  chatRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  chatRowActive: { backgroundColor: colors.surfaceContainerLow },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondaryContainer,
  },
  name: { fontWeight: '600', color: colors.onSurface },
  preview: { color: colors.onSurfaceVariant, fontSize: 14 },
  messages: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  bubbleIn: {
    alignSelf: 'flex-start',
    maxWidth: '70%',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    maxWidth: '70%',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  bubbleOutText: { color: colors.onPrimary },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  input: {
    flex: 1,
    minHeight: spacing.touchTarget,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
  },
  send: {
    minWidth: spacing.touchTarget,
    minHeight: spacing.touchTarget,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendText: { color: colors.onPrimary, fontWeight: '600' },
});
