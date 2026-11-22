import { defineConfig, devices } from '@playwright/test';

const PORT = 4305;

// Smoke tests run against the production build (npm run test:e2e builds first).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
