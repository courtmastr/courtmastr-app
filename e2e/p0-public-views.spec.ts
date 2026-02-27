import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Public Views', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('loads public bracket page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/bracket`);
    await expect(page.getByText(/Live Tournament Bracket|Select a category to view the bracket/i)).toBeVisible();
  });

  test('loads public schedule page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/schedule`);
    await expect(page.getByText(/Published Player Schedule|Tournament not found/i)).toBeVisible();
  });

  test('loads public scoring page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/score`);
    await expect(page.getByText(/Select a match to score|No matches ready to score|Tournament not found/i).first()).toBeVisible();
  });
});
