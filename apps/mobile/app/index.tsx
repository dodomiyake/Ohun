import { colors, spacing } from '@ohun/design-tokens';
import type { ShellView } from '@ohun/contracts';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from '../src/components/states/StateViews';
import { AuthShell } from '../src/shells/AuthShell';
import { DesktopShell } from '../src/shells/DesktopShell';
import { MobileNavShell } from '../src/shells/MobileNavShell';
import { TabletShell } from '../src/shells/TabletShell';

const VIEWS: { id: ShellView; label: string }[] = [
  { id: 'auth', label: 'Auth' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'offline', label: 'Offline' },
  { id: 'error', label: 'Error' },
];

function ShellPreview({ view }: { view: ShellView }) {
  switch (view) {
    case 'auth':
      return <AuthShell />;
    case 'mobile':
      return <MobileNavShell />;
    case 'tablet':
      return <TabletShell />;
    case 'desktop':
      return <DesktopShell />;
    case 'loading':
      return <LoadingState />;
    case 'empty':
      return <EmptyState />;
    case 'offline':
      return <OfflineState />;
    case 'error':
      return <ErrorState />;
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export default function IndexScreen() {
  const [view, setView] = useState<ShellView>('auth');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <Text style={styles.banner}>
        Milestone 1 static shells — authentication and messaging are not connected.
      </Text>
      <ScrollView
        horizontal
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
        accessibilityRole="tablist"
      >
        {VIEWS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setView(item.id)}
            style={[styles.tab, view === item.id && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === item.id }}
          >
            <Text style={[styles.tabLabel, view === item.id && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.preview}>
        <ShellPreview view={view} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondaryContainer,
    color: colors.onSurface,
    fontSize: 14,
  },
  tabs: { maxHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  tabsContent: { paddingHorizontal: spacing.sm, alignItems: 'center', gap: spacing.xs },
  tab: {
    minHeight: spacing.touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: 9999,
  },
  tabActive: { backgroundColor: colors.secondaryContainer },
  tabLabel: { color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 14 },
  tabLabelActive: { color: colors.onSurface },
  preview: { flex: 1 },
});
