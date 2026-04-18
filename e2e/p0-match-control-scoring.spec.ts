import { test, expect } from './fixtures/auth-fixtures';
import {
  getMatchScoreData,
  seedAutoAssignWorkflowScenario,
  seedScoringWorkflowScenario,
} from './utils/workflow-scenarios';

test.describe('P0 - Match Control and Scoring', () => {
  test('opens the manual scoring dialog from a deterministic ready match', async ({ page }) => {
    const scenario = await seedScoringWorkflowScenario('ready');

    await page.goto(`/tournaments/${scenario.tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(scenario.participantOneTeamName).first()).toBeVisible({ timeout: 30000 });
    await page.getByText(scenario.participantOneTeamName).first().click();
    await expect(page.getByText('Enter Match Scores')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Save Scores/i })).toBeVisible();
    await expect(page.getByText(scenario.courtName)).toBeVisible({ timeout: 30000 });
  });

  test('records a walkover from the shared manual scoring dialog', async ({ page }) => {
    const scenario = await seedScoringWorkflowScenario('ready');

    await page.goto(`/tournaments/${scenario.tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(scenario.participantOneTeamName).first()).toBeVisible({ timeout: 30000 });
    await page.getByText(scenario.participantOneTeamName).first().click();

    await expect(page.getByText('Enter Match Scores')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Walkover$/i })).toBeVisible();

    await page.getByRole('button', { name: /^Walkover$/i }).click();
    await expect(page.getByRole('radio', { name: scenario.participantOneTeamName })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Record Walkover$/i })).toBeVisible();

    await page.getByRole('radio', { name: scenario.participantOneTeamName }).check();
    await page.getByRole('button', { name: /^Record Walkover$/i }).click();

    await expect(page.getByText('Walkover recorded')).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const matchScore = await getMatchScoreData(
        scenario.tournamentId,
        scenario.categoryId,
        scenario.matchId,
      );

      return {
        status: matchScore?.status,
        winnerId: matchScore?.winnerId,
        scores: Array.isArray(matchScore?.scores) ? matchScore.scores.length : null,
      };
    }, { timeout: 30000 }).toEqual({
      status: 'walkover',
      winnerId: 'reg-scoreable-home',
      scores: 0,
    });
  });

  test('skips blocked due matches and auto-assigns the next eligible published match', async ({ page }) => {
    const scenario = await seedAutoAssignWorkflowScenario();

    await page.goto(`/tournaments/${scenario.tournamentId}/match-control`);
    await expect(page.getByRole('button', { name: /Command Center/i })).toBeVisible({ timeout: 30000 });

    await expect(page.getByText(scenario.blockedCheckInTeamName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.blockedAbsentTeamName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.blockedPublishTeamName)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Waiting for check-in').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Publish schedule first')).toBeVisible({ timeout: 30000 });

    await expect(page.getByText('Auto-assign skipped blocked match')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Auto-assigned .* to Court 1\./i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/matches blocked from assignment/i)).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const matchScore = await getMatchScoreData(
        scenario.tournamentId,
        scenario.categoryId,
        scenario.assignedMatchId,
      );

      return {
        status: matchScore?.status,
        courtId: matchScore?.courtId,
      };
    }, { timeout: 30000 }).toEqual({
      status: 'in_progress',
      courtId: scenario.courtId,
    });

    await expect(page.getByText(/1 in progress/i)).toBeVisible({ timeout: 30000 });
  });
});
