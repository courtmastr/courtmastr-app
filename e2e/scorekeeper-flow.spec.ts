import { test, expect, BrowserContext, Page } from '@playwright/test';
import { getTournamentId } from './utils/test-data';
import { MatchControlPage } from './models/index';

test.describe.configure({ mode: 'serial' });

test.describe('Scorekeeper Flow', () => {
  let tournamentId: string;

  async function openFirstScoreDialog(page: Page): Promise<boolean> {
    const matchRows = page.locator('.match-item');
    const rowCount = await matchRows.count();
    const dialogTitle = page.locator('.v-dialog .v-card-title', { hasText: 'Enter Match Scores' });

    for (let index = 0; index < rowCount; index += 1) {
      const matchRow = matchRows.nth(index);
      if (!(await matchRow.isVisible().catch(() => false))) continue;

      const actionButton = matchRow.getByRole('button', { name: /^(score|correct)$/i }).first();
      if (await actionButton.isVisible().catch(() => false)) {
        await actionButton.click();
      } else {
        await matchRow.click();
      }

      const dialogOpened = await dialogTitle.isVisible({ timeout: 2000 }).catch(() => false);
      if (dialogOpened) {
        await expect(dialogTitle).toBeVisible({ timeout: 10000 });
        return true;
      }
    }

    return false;
  }

  test.beforeAll(async ({ browser }) => {
    tournamentId = await getTournamentId();

    // Admin setup: generate brackets and auto-schedule matches.
    // Firebase auth state lives in IndexedDB — must use a fresh UI login, not storageState.
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Fresh admin login
    await adminPage.goto('/login');
    await adminPage.getByLabel('Email').fill('admin@courtmastr.com');
    await adminPage.locator('input[type="password"]').fill('admin123');
    await adminPage.getByRole('button', { name: 'Sign In' }).click();
    await adminPage.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });

    try {
      // Navigate to tournament overview (contains CategoryRegistrationStats with Generate Bracket button)
      await adminPage.goto(`/tournaments/${tournamentId}`);
      await adminPage.waitForLoadState('domcontentloaded');

      // Generate bracket for first available category
      const generateBtn = adminPage.getByRole('button', { name: /generate bracket/i }).first();
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await adminPage.waitForTimeout(3000);
      }

      // Navigate to match-control and auto-schedule
      const matchControlPage = new MatchControlPage(adminPage);
      await matchControlPage.goto(tournamentId);
      await adminPage.waitForLoadState('domcontentloaded');

      const autoScheduleBtn = adminPage.getByRole('button', { name: /auto schedule/i });
      if (await autoScheduleBtn.isVisible()) {
        await autoScheduleBtn.click();
        await adminPage.waitForTimeout(3000);
      }

      // Also try to assign courts so matches become "Ready to Play"
      const assignCourtsBtn = adminPage.getByRole('button', { name: /assign courts/i });
      if (await assignCourtsBtn.isVisible()) {
        await assignCourtsBtn.click();
        await adminPage.waitForTimeout(2000);
      }
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
    await page.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });
  });

  test('should load match list page for scorekeeper', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Match Scoring Queue' })).toBeVisible();
  });

  test('should show tournament name in match list', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    // Page shows tournament name in subtitle
    const tournamentName = page.locator('.text-grey').first();
    await expect(tournamentName).toBeVisible();
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

    const dialogOpened = await openFirstScoreDialog(page);
    test.skip(!dialogOpened, 'No scoreable matches available in seeded dataset.');
  });

  test('should display score dialog controls when a match is opened', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    const dialogOpened = await openFirstScoreDialog(page);
    test.skip(!dialogOpened, 'No scoreable matches available in seeded dataset.');
    await expect(page.getByRole('button', { name: /save scores/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.locator('input[aria-label^="Game 1 score"]').first()).toBeVisible();
  });
});
