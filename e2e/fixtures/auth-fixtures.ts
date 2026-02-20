import { test as base, expect } from '@playwright/test';
import { getTournamentId } from '../utils/test-data';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@courtmastr.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/tournaments', { timeout: 10000 });
    await use(page);
  },
});

export { expect, getTournamentId };
