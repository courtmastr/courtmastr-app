import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';
import type { Page } from '@playwright/test';

test.describe('P0 - Seeding Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  const openSeedsDialog = async (page: Page, categoryName: string): Promise<void> => {
    const categoryCard = page.locator('.category-card', { hasText: categoryName }).first();
    await expect(categoryCard).toBeVisible({ timeout: 10000 });
    await categoryCard.getByLabel(/open actions menu/i).click();
    await page.locator('.v-overlay-container .v-list-item', { hasText: 'Seeds' }).first().click();
    await expect(page.locator('.v-dialog').filter({ hasText: 'Manage Seeds' }).last()).toBeVisible();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/categories`);
    await expect(page.getByTestId('add-category-btn')).toBeVisible({ timeout: 10000 });
  });

  test('should open seeding dialog for category', async ({ page }) => {
    await openSeedsDialog(page, "Men's Singles");
    const dialog = page.locator('.v-dialog').filter({ hasText: 'Manage Seeds' }).last();
    await expect(dialog.getByText(/seeding/i)).toBeVisible();
  });

  test('should assign seed number to participant', async ({ page }) => {
    await openSeedsDialog(page, "Men's Singles");
    const dialog = page.locator('.v-dialog').filter({ hasText: 'Manage Seeds' }).last();

    const seedInput = dialog.locator('[data-testid^="seed-input-"]').first().locator('input');
    await seedInput.fill('1');

    await dialog.getByTestId('close-seeding-dialog-btn').click();
    
    await expect(dialog).not.toBeVisible();
  });

  test('should auto-seed participants', async ({ page }) => {
    await openSeedsDialog(page, "Men's Singles");
    const dialog = page.locator('.v-dialog').filter({ hasText: 'Manage Seeds' }).last();

    await dialog.getByTestId('auto-assign-seeds-btn').click();
    const firstSeedInput = dialog.locator('[data-testid^="seed-input-"]').first().locator('input');
    await expect(firstSeedInput).toHaveValue('1');
    
    await dialog.getByTestId('close-seeding-dialog-btn').click();
  });
});
