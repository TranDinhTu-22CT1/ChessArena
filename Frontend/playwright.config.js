import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '*.spec.js',
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5187', headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187', url: 'http://127.0.0.1:5187/tests/browser/fixture.html', reuseExistingServer: false }
});
