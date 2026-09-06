/**
 * Ohun V2 colour tokens from approved Stitch design system
 * (project 16264346330507370332). Light theme only.
 */
export const colors = {
  background: '#f8f9fd',
  surface: '#ffffff',
  surfaceContainer: '#edeef2',
  surfaceContainerLow: '#f2f3f7',
  surfaceContainerHigh: '#e7e8ec',
  surfaceContainerHighest: '#e1e2e6',
  onBackground: '#191c1f',
  onSurface: '#191c1f',
  onSurfaceVariant: '#444654',
  primary: '#063ac1',
  primaryContainer: '#3155d9',
  onPrimary: '#ffffff',
  secondary: '#50606e',
  secondaryContainer: '#d4e5f5',
  onSecondary: '#ffffff',
  tertiary: '#005539',
  tertiaryContainer: '#00704c',
  onTertiary: '#ffffff',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  outline: '#747686',
  outlineVariant: '#c4c5d7',
  success: '#10b981',
  focusRing: '#063ac1',
} as const;

export type ColorToken = keyof typeof colors;
