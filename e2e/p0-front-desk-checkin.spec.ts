import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Front Desk Check-in', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/checkin`);
    await page.waitForSelector('text=Check-In Command Center', { timeout: 15000 });
  });

  test('loads front-desk check-in shell with rapid/bulk controls', async ({ page }) => {
    await expect(page.getByText('Check-In Command Center')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rapid' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bulk' })).toBeVisible();
  });

  test('allows toggling between rapid and bulk modes', async ({ page }) => {
    const rapidButton = page.getByRole('button', { name: 'Rapid' });
    const bulkButton = page.getByRole('button', { name: 'Bulk' });

    await bulkButton.click();
    await expect(bulkButton).toBeVisible();

    await rapidButton.click();
    await expect(rapidButton).toBeVisible();
  });
});
