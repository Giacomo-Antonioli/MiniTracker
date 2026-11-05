import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/MiniTracker/',
    trace: 'retain-on-failure',
    // The flows start on the Backlog (the app's default start page is Home).
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'startPage', value: 'backlog' }] }] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /phone\.spec/ },
    // iPad-sized screen in Chromium (keeps CI to one browser for now).
    { name: 'ipad', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true }, testIgnore: /phone\.spec/ },
    // Phone-sized screen (#31); only the phone flows run here.
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/MiniTracker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
