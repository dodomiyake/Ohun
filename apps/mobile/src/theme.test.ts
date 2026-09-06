import { describe, expect, it } from 'vitest';
import { colors, spacing } from '@ohun/design-tokens';

describe('mobile token mapping', () => {
  it('maps shared design tokens for StyleSheet usage', () => {
    expect(colors.primary).toBe('#063ac1');
    expect(spacing.touchTarget).toBe(44);
  });
});
