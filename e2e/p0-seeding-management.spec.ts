import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Seeding Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}`);
    await page.waitForSelector('text=Tournament Status', { timeout: 10000 });
  });

  test('should open seeding dialog for category', async ({ page }) => {
    const categoryCard = page.locator('.v-card', { hasText: "Men's Singles" });
    await categoryCard.getByTestId('manage-seeds-btn').click();

    const dialog = page.locator('.v-dialog');
    await dialog.waitFor({ state: 'visible' });
    
    await expect(dialog.getByText(/seeding/i)).toBeVisible();
  });

  test('should assign seed number to participant', async ({ page }) => {
    const categoryCard = page.locator('.v-card', { hasText: "Men's Singles" });
    await categoryCard.getByTestId('manage-seeds-btn').click();

    const dialog = page.locator('.v-dialog');
    await dialog.waitFor({ state: 'visible' });

    const seedSelect = dialog.locator('[data-testid^="seed-input-"]').first();
    await seedSelect.click();
    await page.getByRole('option', { name: 'Seed #1' }).click();

    await dialog.getByRole('button', { name: /done/i }).click();
    
    await expect(dialog).not.toBeVisible();
  });

  test('should auto-seed participants', async ({ page }) => {
    const categoryCard = page.locator('.v-card', { hasText: "Men's Singles" });
    await categoryCard.getByTestId('manage-seeds-btn').click();

    const dialog = page.locator('.v-dialog');
    await dialog.waitFor({ state: 'visible' });

    await dialog.getByTestId('auto-assign-seeds-btn').click();

    await expect(page.getByText(/Auto-assigned|success/i)).toBeVisible();
    
    await dialog.getByTestId('close-seeding-dialog-btn').click();
  });
});
