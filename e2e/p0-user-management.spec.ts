import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';
import { waitForPostLoginLanding } from './utils/auth';

test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForPostLoginLanding(page, 15000);
}

test.describe('P0 - User Management Access', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('blocks scorekeeper from tournament settings access', async ({ page }) => {
    await login(page, 'scorekeeper@courtmastr.com', 'score123');
    await page.goto(`/tournaments/${tournamentId}/settings`);
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows organizer-management controls for admin in settings', async ({ page }) => {
    await login(page, 'admin@courtmastr.com', 'admin123');
    await page.goto(`/tournaments/${tournamentId}/settings`);

    await expect(page.getByText('Co-Organizers')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Add organizer' })).toBeVisible();
  });
});
