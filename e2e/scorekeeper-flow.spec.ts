import { test, expect, BrowserContext, Page } from '@playwright/test';
import { waitForPostLoginLanding } from './utils/auth';
import { seedScoringWorkflowScenario } from './utils/workflow-scenarios';

test.describe.configure({ mode: 'serial' });

test.describe('Scorekeeper Flow', () => {
  let tournamentId: string;
  let participantOneTeamName: string;

  async function openScoreDialog(page: Page, teamName: string): Promise<void> {
    await expect(page.getByText(teamName).first()).toBeVisible({ timeout: 30000 });
    await page.getByText(teamName).first().click();
    await expect(page.getByText('Enter Match Scores')).toBeVisible({ timeout: 15000 });
  }

  test.beforeAll(async ({ browser }) => {
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const scenario = await seedScoringWorkflowScenario('ready');
    tournamentId = scenario.tournamentId;
    participantOneTeamName = scenario.participantOneTeamName;

    await adminPage.goto('/login');
    await adminPage.getByLabel('Email').fill('admin@courtmastr.com');
    await adminPage.locator('input[type="password"]').fill('admin123');
    await adminPage.getByRole('button', { name: 'Sign In' }).click();
    await waitForPostLoginLanding(adminPage, 15000);

    try {
      await adminPage.goto(`/tournaments/${tournamentId}/matches`);
      await expect(adminPage.getByText(participantOneTeamName).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await adminPage.close();
      await adminContext.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Firebase auth state lives in IndexedDB — storageState alone does not restore it.
    // Do a fresh scorekeeper login before each test.
    await page.goto('/login');
    await page.getByLabel('Email').fill('scorekeeper@courtmastr.com');
    await page.locator('input[type="password"]').fill('score123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForPostLoginLanding(page, 15000);
  });

  test('should display match sections or empty state', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByText(/in progress|ready to play|scheduled|no matches available/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should open score dialog from a ready match', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await openScoreDialog(page, participantOneTeamName);
  });

  test('should display score dialog controls when a match is opened', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await openScoreDialog(page, participantOneTeamName);
    await expect(page.getByRole('button', { name: /save scores/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.locator('input[aria-label^="Game 1 score"]').first()).toBeVisible();
  });
});
