import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const rootDir = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'npm run build -w @ohun/web && npm run preview -w @ohun/web -- --host 127.0.0.1 --port 4173 --strictPort',
    cwd: rootDir,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
