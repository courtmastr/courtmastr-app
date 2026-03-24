import { test, expect } from './fixtures/auth-fixtures';
import {
  getLifecyclePlayerSnapshot,
  seedCompletedLifecycleScenario,
} from './utils/lifecycle-scenarios';

test.describe('P0 - Post Completion Outcomes', () => {
  test('shows player profile stats, tournament reports, and public leaderboard results after completion', async ({ page }) => {
    const scenario = await seedCompletedLifecycleScenario();

    await expect.poll(async () => {
      return getLifecyclePlayerSnapshot(scenario.representativePlayerId);
    }, { timeout: 30000 }).toMatchObject({
      playerId: scenario.representativePlayerId,
      overallWins: 5,
      overallLosses: 0,
      tournamentsPlayed: 1,
      doublesWins: 5,
    });

    await page.goto(`/players/${scenario.representativePlayerId}`);
    await expect(page.getByText(scenario.representativePlayerName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Wins')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="match-history-panels"]')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.tournamentName).first()).toBeVisible({ timeout: 30000 });

    await page.goto(`/tournaments/${scenario.tournamentId}/reports`);
    await expect(page.getByRole('heading', { name: 'Tournament Reports' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`${scenario.expected.totalCompletedMatches}/${scenario.expected.totalCompletedMatches} completed`)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`Checked In: ${scenario.expected.checkedInRegistrations}`)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Registration Status')).toBeVisible({ timeout: 30000 });

    await page.goto(`/tournaments/${scenario.tournamentId}/categories/${scenario.categoryId}/leaderboard`);
    await expect(page.getByRole('heading', { name: 'Category Leaderboard' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Leader').first()).toBeVisible({ timeout: 30000 });
  });
});
