import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Search and Filter', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForSelector('text=Tournaments', { timeout: 10000 });
  });

  test.describe('Global Search', () => {
    test.skip('should display global search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="search" i]').or(page.getByPlaceholder(/search/i));
      await expect(searchInput).toBeVisible();
    });

    test.skip('should search tournaments by name', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="search" i]').or(page.getByPlaceholder(/search/i));
      await searchInput.fill('E2E Test');
      await page.waitForTimeout(500);

      await expect(page.getByText(/E2E Test Tournament/i).first()).toBeVisible();
    });
  });

  test.describe('Registration Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/tournaments/${tournamentId}/registrations`);
      await page.waitForLoadState('domcontentloaded');
    });

    test('should filter by category', async ({ page }) => {
      const categoryFilter = page.getByRole('combobox', { name: 'Category' }).first();
      await expect(categoryFilter).toBeVisible();
      await categoryFilter.click();
      await page.getByRole('option').first().click();

      await expect(page.locator('table').first()).toBeVisible();
    });

    test('should search by participant name', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search participant name');
      await expect(searchInput).toBeVisible();

      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
      const firstRowText = (await firstRow.innerText()).trim();
      const firstToken = firstRowText.split(/\s+/).find((token) => token.length >= 3) || 'a';

      await searchInput.fill(firstToken);
      await page.waitForTimeout(500);
      await expect(page.locator('tbody tr').first()).toContainText(new RegExp(firstToken, 'i'));
    });
  });
});
