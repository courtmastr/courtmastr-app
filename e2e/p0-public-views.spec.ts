import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';
import { getMatchScoreData, seedLevelPublishWorkflowScenario } from './utils/workflow-scenarios';
import { loginAsAdminUi } from './utils/auth';

test.describe('P0 - Public Views', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('loads public bracket page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/bracket`);
    await expect(page.getByText('Live Tournament Bracket')).toBeVisible();
  });

  test('loads public schedule page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/schedule`);
    await expect(page.getByText(/Live Tournament Schedule|Tournament not found/i)).toBeVisible();
  });

  test('loads public scoring page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/score`);
    await expect(page.getByText(/Select a match to score|No matches ready to score|Tournament not found/i).first()).toBeVisible();
  });

  test('publishes a level schedule from Categories and clears the draft state on the public schedule', async ({ page }) => {
    const scenario = await seedLevelPublishWorkflowScenario();

    await loginAsAdminUi(page, 15000);
    await page.goto(`/tournaments/${scenario.tournamentId}/categories`);
    await expect(page.getByText(scenario.categoryName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Publish Level Schedule' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Publish Level Schedule' }).click();

    await expect(page.getByText(/Published schedule/i)).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const matchScore = await getMatchScoreData(
        scenario.tournamentId,
        scenario.categoryId,
        scenario.levelMatchId,
        scenario.levelId,
      );

      return matchScore?.scheduleStatus;
    }, { timeout: 30000 }).toBe('published');

    await page.goto(`/tournaments/${scenario.tournamentId}/schedule?category=${scenario.categoryId}`);
    await expect(page.getByText('Live Tournament Schedule')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.participantOneTeamName).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.participantTwoTeamName).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Schedule is in draft — times may still change before the event starts.')).toHaveCount(0);
  });
});
