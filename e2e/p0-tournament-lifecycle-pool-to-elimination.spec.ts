import { test, expect } from './fixtures/auth-fixtures';
import {
  getLifecycleSnapshot,
  seedCompletedLifecycleScenario,
} from './utils/lifecycle-scenarios';

test.describe('P0 - Tournament Lifecycle Pool to Elimination', () => {
  test('shows the completed men\'s doubles pool-to-elimination lifecycle for a seeded 28-team tournament', async ({ page }) => {
    const scenario = await seedCompletedLifecycleScenario();

    await page.goto(`/tournaments/${scenario.tournamentId}/categories`);
    await expect(page.getByRole('heading', { name: /Categories/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.categoryName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Pool Play to Elimination')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Seeded').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'View Results' })).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const snapshot = await getLifecycleSnapshot();
      return {
        registrationCount: snapshot.registrationCount,
        checkedInRegistrations: snapshot.checkedInRegistrations,
        tournamentPlayerCount: snapshot.tournamentPlayerCount,
        allRegistrationEmailsPresent: snapshot.allRegistrationEmailsPresent,
        completedPoolMatchCount: snapshot.completedPoolMatchCount,
        levelCount: snapshot.levelCount,
        completedLevelMatchCount: snapshot.completedLevelMatchCount,
        tournamentStatus: snapshot.tournamentStatus,
        tournamentState: snapshot.tournamentState,
        categoryStatus: snapshot.categoryStatus,
      };
    }, { timeout: 30000 }).toEqual({
      registrationCount: scenario.expected.registrationCount,
      checkedInRegistrations: scenario.expected.checkedInRegistrations,
      tournamentPlayerCount: scenario.expected.tournamentPlayerCount,
      allRegistrationEmailsPresent: true,
      completedPoolMatchCount: scenario.expected.completedPoolMatchCount,
      levelCount: scenario.expected.levelCount,
      completedLevelMatchCount: scenario.expected.completedLevelMatchCount,
      tournamentStatus: 'completed',
      tournamentState: 'COMPLETED',
      categoryStatus: 'completed',
    });

    await page.goto(`/tournaments/${scenario.tournamentId}`);
    await expect(page.getByText('Tournament Completed')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: 'View Results' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('100%')).toBeVisible({ timeout: 30000 });
  });
});
