import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

const isProduction = process.env.TEST_ENV === 'production';
const baseURL = isProduction
  ? process.env.PRODUCTION_URL || 'https://your-app.web.app'
  : 'http://localhost:3000';

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: 'e2e-report/html', open: 'never' }],
  ['json', { outputFile: 'e2e-report/results.json' }],
];

if (process.env.CI) {
  reporters.push(['junit', { outputFile: 'e2e-report/results.xml' }]);
}

const AUTH_STORAGE = 'e2e/.auth/admin.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The Firebase emulator and seeded E2E flows share mutable state.
  // Run serially so the suite measures product behavior instead of lock contention.
  workers: 1,
  reporter: reporters,
  outputDir: 'test-results/e2e',
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
      name: 'feature-smoke',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testMatch: [/smoke\.spec\.ts$/],
    },
    {
      name: 'feature-auth',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testMatch: [/p0-auth-and-role-guards\.spec\.ts$/, /p0-user-management\.spec\.ts$/],
    },
    {
      name: 'feature-registration',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testMatch: [
        /user-registration\.spec\.ts$/,
        /p0-front-desk-checkin\.spec\.ts$/,
        /p0-self-checkin-kiosk\.spec\.ts$/,
        /p0-search-and-filter\.spec\.ts$/,
        /p0-import-email-validation\.spec\.ts$/,
      ],
    },
    {
      name: 'feature-scoring',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testMatch: [
        /scorekeeper-flow\.spec\.ts$/,
        /p0-match-control-scoring\.spec\.ts$/,
        /p0-score-correction\.spec\.ts$/,
      ],
    },
    {
      name: 'feature-tournament-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STORAGE,
      },
      dependencies: ['setup'],
      testMatch: [
        /p0-category-management\.spec\.ts$/,
        /p0-court-management\.spec\.ts$/,
        /p0-org-branding-public-home\.spec\.ts$/,
        /p0-seeding-management\.spec\.ts$/,
        /p0-tournament-lifecycle-pool-to-elimination\.spec\.ts$/,
        /p0-tournament-settings\.spec\.ts$/,
      ],
    },
    {
      name: 'feature-public-leaderboard',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STORAGE,
      },
      dependencies: ['setup'],
      testMatch: [
        /p0-post-completion-outcomes\.spec\.ts$/,
        /p0-public-views\.spec\.ts$/,
        /leaderboard\.spec\.ts$/,
        /leaderboard-pool-to-elimination\.spec\.ts$/,
        /p0-player-profile\.spec\.ts$/,
      ],
    },
    {
      name: 'feature-regression',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testMatch: [/negative-tests\.spec\.ts$/, /edge-cases\.spec\.ts$/],
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
