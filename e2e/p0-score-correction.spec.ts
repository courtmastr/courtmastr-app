import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Score Correction', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('shows correct-score action for admin on scoring interface', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    const matchItem = page.locator('.match-item').first();
    const matchCount = await page.locator('.match-item').count();
    test.skip(matchCount === 0, 'Seeded data has no match rows to open scoring');

    await matchItem.click();
    await page.waitForURL(/\/matches\/.+\/score/, { timeout: 15000 });

    await expect(page.getByRole('button', { name: /Correct Score/i })).toBeVisible();
  });
});
