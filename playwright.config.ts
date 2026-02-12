import { defineConfig, devices } from '@playwright/test';

const isProduction = process.env.TEST_ENV === 'production';
const baseURL = isProduction 
  ? process.env.PRODUCTION_URL || 'https://your-app.web.app'
  : 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
    ...(process.env.CI ? [['junit', { outputFile: 'e2e-results.xml' }]] : [])
  ] as any,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [/smoke\.spec\.ts/, /scorekeeper.*\.spec\.ts/, /user-registration\.spec\.ts/],
    },
    {
      name: 'chromium-no-auth',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: [/smoke\.spec\.ts/, /user-registration\.spec\.ts/],
    },
    {
      name: 'chromium-p0',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /p0-.*\.spec\.ts/,
    },
    {
      name: 'chromium-scorekeeper',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/scorekeeper.json',
      },
      dependencies: ['setup'],
      testMatch: /scorekeeper.*\.spec\.ts/,
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /.*mobile\.spec\.ts/,
    },
  ],
  webServer: isProduction 
    ? undefined 
    : [
        {
          command: 'npm run emulators',
          url: 'http://localhost:4000',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
      ],
});
