import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Tournament Settings', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/settings`);
    await page.waitForSelector('text=Settings', { timeout: 10000 });
  });

   test('should update tournament basic information', async ({ page }) => {
     const newName = 'Updated Tournament Name';
     const newDescription = 'Updated description for testing';
     const newLocation = 'Updated Location';

     await page.waitForSelector('[data-testid="tournament-name"]', { timeout: 10000 });

     const nameInput = page.getByTestId('tournament-name').locator('input');
     await nameInput.fill(newName);

     const descInput = page.getByTestId('tournament-description').locator('textarea');
     await descInput.fill(newDescription);

     const locInput = page.getByTestId('tournament-location').locator('input');
     await locInput.fill(newLocation);

     await page.getByRole('button', { name: /save changes/i }).click();

     await expect(page.getByText(/saved|success/i).first()).toBeVisible();
     await expect(nameInput).toHaveValue(newName);
     await expect(descInput).toHaveValue(newDescription);
     await expect(locInput).toHaveValue(newLocation);
   });

   test('should show delete confirmation dialog', async ({ page }) => {
     await page.getByTestId('delete-tournament-btn').click();

     await expect(page.getByTestId('delete-tournament-dialog')).toBeVisible();
     await expect(page.getByRole('button', { name: 'Delete Permanently' })).toBeVisible();

     await page.getByRole('button', { name: /cancel/i }).click();
   });
});
