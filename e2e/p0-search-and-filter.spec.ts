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
      const categoryFilter = page.getByTestId('filter-category-select').or(page.getByLabel(/category/i).first());
      await expect(categoryFilter).toBeVisible();
      await categoryFilter.click();
      await page.getByRole('option').first().click();

      await expect(page.locator('table').first()).toBeVisible();
    });

    test('should search by participant name', async ({ page }) => {
      // Try data-testid first, fall back to placeholder-based search input
      const searchByTestId = page.getByTestId('search-participant-input');
      const searchByPlaceholder = page.getByPlaceholder(/search by name/i);
      const searchInput = (await searchByTestId.isVisible()) ? searchByTestId : searchByPlaceholder;
      await expect(searchInput).toBeVisible();
      await searchInput.fill('John');
      await page.waitForTimeout(500);
      await expect(page.getByText(/john/i).first()).toBeVisible();
    });
  });
});
