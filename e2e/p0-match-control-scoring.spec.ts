import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Match Control and Scoring', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('loads match-control command center', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/match-control`);
    await expect(page.getByText('Match Control').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Command Center/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Live View/i })).toBeVisible();
  });

  test('opens scoring interface from matches list when a match is available', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    const matchItem = page.locator('.match-item').first();
    const matchCount = await page.locator('.match-item').count();
    test.skip(matchCount === 0, 'Seeded data has no scorable matches');

    await matchItem.click();
    await page.waitForURL(/\/matches\/.+\/score/, { timeout: 15000 });
    await expect(page.locator('.v-container').first()).toBeVisible();
  });
});
