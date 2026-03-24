import { test as base, expect } from '@playwright/test';
import { getTournamentId } from '../utils/test-data';
import { waitForPostLoginLanding } from '../utils/auth';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@courtmastr.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForPostLoginLanding(page, 10000);
    await use(page);
  },
});

export { expect, getTournamentId };
