import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';
import type { Page } from '@playwright/test';

test.describe('P0 - Category Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  const openCategoryMenuAction = async (
    page: Page,
    categoryName: string,
    actionLabel: 'Edit Category' | 'Delete Category' | 'Seeds'
  ): Promise<void> => {
    const categoryCard = page.locator('.category-card', { hasText: categoryName }).first();
    await expect(categoryCard).toBeVisible();
    await categoryCard.getByLabel(/open actions menu/i).click();
    await page.locator('.v-overlay-container .v-list-item', { hasText: actionLabel }).first().click();
  };

  const addCategory = async (
    page: Page,
    categoryName: string
  ): Promise<void> => {
    await page.getByTestId('add-category-btn').click();
    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    await dialog.getByTestId('category-type-select').click();
    await page.getByRole('option', { name: 'Singles' }).click();
    await dialog.getByTestId('category-gender-select').click();
    await page.getByRole('option', { name: 'Open' }).click();

    const nameInput = dialog.getByTestId('category-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill(categoryName);
    await dialog.getByTestId('save-category-btn').click();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/categories`);
    await expect(page.getByTestId('add-category-btn')).toBeVisible({ timeout: 10000 });
  });

  test('should add new category', async ({ page }) => {
    const categoryName = `Test Category ${Date.now()}`;
    await addCategory(page, categoryName);
    await expect(page.locator('.category-card', { hasText: categoryName }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing category', async ({ page }) => {
    const categoryName = `Editable Category ${Date.now()}`;
    await addCategory(page, categoryName);
    await expect(page.locator('.category-card', { hasText: categoryName }).first()).toBeVisible({ timeout: 10000 });

    await openCategoryMenuAction(page, categoryName, 'Edit Category');

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    const updatedName = `Updated Category ${Date.now()}`;
    const nameInput = dialog.getByTestId('category-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill(updatedName);
    await dialog.getByTestId('save-category-btn').click();

    await expect(page.locator('.category-card', { hasText: updatedName }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should delete category', async ({ page }) => {
    const categoryName = `Delete Category ${Date.now()}`;
    await addCategory(page, categoryName);
    const categoryCard = page.locator('.category-card', { hasText: categoryName }).first();
    await expect(categoryCard).toBeVisible({ timeout: 10000 });

    await openCategoryMenuAction(page, categoryName, 'Delete Category');

    const dialog = page.locator('.v-dialog').filter({ hasText: 'Delete Category?' }).last();
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('.category-card', { hasText: categoryName })).toHaveCount(0, { timeout: 10000 });
  });
});
