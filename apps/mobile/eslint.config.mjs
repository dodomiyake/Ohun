import { baseConfig } from '@ohun/config/eslint.base.js';
import globals from 'globals';

export default [
  ...baseConfig,
  {
    ignores: ['babel.config.js', 'metro.config.js', '.expo/**', 'dist-export/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
