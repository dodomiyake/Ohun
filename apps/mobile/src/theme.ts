import { colors, radii, spacing, typography } from '@ohun/design-tokens';
import { StyleSheet } from 'react-native';

export const tokens = {
  colors,
  radii,
  spacing,
  typography,
};

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.headlineMd.fontSize,
    fontWeight: typography.headlineMd.fontWeight,
    lineHeight: typography.headlineMd.lineHeight,
    color: colors.onSurface,
  },
  body: {
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    color: colors.onSurfaceVariant,
  },
  touchTarget: {
    minHeight: spacing.touchTarget,
    minWidth: spacing.touchTarget,
  },
});
