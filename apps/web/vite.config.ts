import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/ohun-icon.svg', 'fonts/Nunito-ExtraBold.woff2'],
      manifest: {
        name: 'Ohun',
        short_name: 'Ohun',
        description: 'Private real-time messaging for friends and family',
        theme_color: '#063ac1',
        background_color: '#f8f9fd',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/brand/ohun-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/brand/ohun-icon-light-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/ohun-icon-light-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
