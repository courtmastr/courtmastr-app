import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Category Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}?tab=categories`);
    await page.waitForSelector('text=Categories', { timeout: 10000 });
  });

  test('should display category management tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /categories/i })).toBeVisible();
    await expect(page.getByTestId('add-category-btn')).toBeVisible();
  });

  test('should add new category', async ({ page }) => {
    await page.getByTestId('add-category-btn').click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    // Select type and gender FIRST so generateCategoryName() fires before we set our custom name
    await dialog.getByTestId('category-type-select').click();
    await page.getByRole('option', { name: 'Singles' }).click();
    await dialog.getByTestId('category-gender-select').click();
    await page.getByRole('option', { name: 'Open' }).click();

    // Fill name AFTER auto-generation so it is not overwritten
    const nameInput = dialog.getByTestId('category-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill('Test Category');

    await dialog.getByTestId('save-category-btn').click();

    await expect(page.getByText('Test Category')).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing category', async ({ page }) => {
    const categoryItem = page.locator('.v-list-item', { hasText: "Men's Singles" }).first();
    await categoryItem.getByTestId('edit-category-btn').click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    const nameInput = dialog.getByTestId('category-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill("Men's Singles Updated");
    await dialog.getByTestId('save-category-btn').click();

    await expect(page.getByText("Men's Singles Updated")).toBeVisible({ timeout: 10000 });
  });

  test('should delete category', async ({ page }) => {
    await page.reload();
    await page.waitForSelector('text=Categories', { timeout: 10000 });

    // The component uses native confirm() — register handler before triggering delete
    page.on('dialog', dialog => dialog.accept());

    const categoryItem = page.locator('.v-list-item', { hasText: 'Test Category' }).first();
    await categoryItem.getByTestId('delete-category-btn').click();

    await expect(page.getByText('Test Category')).not.toBeVisible({ timeout: 10000 });
  });
});
