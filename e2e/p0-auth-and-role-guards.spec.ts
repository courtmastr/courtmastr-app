import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/tournaments', { timeout: 15000 });
}

test.describe('P0 - Auth and Role Guards', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('redirects unauthenticated users to login for protected routes', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/match-control`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('blocks scorekeeper from admin-only match-control route', async ({ page }) => {
    await login(page, 'scorekeeper@courtmastr.com', 'score123');

    await page.goto(`/tournaments/${tournamentId}/match-control`);
    await expect(page).toHaveURL('/tournaments');
  });
});
