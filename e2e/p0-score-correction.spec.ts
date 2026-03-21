import { test, expect } from './fixtures/auth-fixtures';
import { seedScoringWorkflowScenario } from './utils/workflow-scenarios';

test.describe('P0 - Score Correction', () => {
  test('shows correct-score action for admin on scoring interface', async ({ page }) => {
    const scenario = await seedScoringWorkflowScenario('completed');

    await page.goto(`/tournaments/${scenario.tournamentId}/matches/${scenario.matchId}/score?category=${scenario.categoryId}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: /Correct Score/i })).toBeVisible();
    await expect(page.getByText('Match Complete')).toBeVisible();
    await expect(page.getByText(/Scoring Home Player/i)).toBeVisible();
  });
});
