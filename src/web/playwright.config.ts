import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './node_modules/.cache/playwright-results',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:45173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'node server.js', cwd: '../api', env: { PORT: '43100' }, url: 'http://127.0.0.1:43100/todos', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 45173 --strictPort', env: { VITE_API_BASE_URL: 'http://127.0.0.1:43100' }, url: 'http://127.0.0.1:45173', reuseExistingServer: false },
  ],
})