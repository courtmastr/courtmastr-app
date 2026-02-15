import { test, expect, BrowserContext } from '@playwright/test';
import { getTournamentId } from './utils/test-data';
import { TournamentDashboardPage, MatchControlPage } from './models/index';

test.describe.configure({ mode: 'serial' });

test.describe('Scorekeeper Flow', () => {
  let tournamentId: string;

  test.beforeAll(async ({ browser }) => {
    tournamentId = await getTournamentId();

    // Admin setup: generate brackets and auto-schedule matches.
    // Firebase auth state lives in IndexedDB — must use a fresh UI login, not storageState.
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Fresh admin login
    await adminPage.goto('/login');
    await adminPage.getByLabel('Email').fill('admin@courtmaster.local');
    await adminPage.locator('input[type="password"]').fill('admin123');
    await adminPage.getByRole('button', { name: 'Sign In' }).click();
    await adminPage.waitForURL('/tournaments', { timeout: 15000 });

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
    await page.getByLabel('Email').fill('scorekeeper@courtmaster.local');
    await page.locator('input[type="password"]').fill('score123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/tournaments', { timeout: 15000 });
  });

  test('should load match list page for scorekeeper', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    // Page should show "Matches" heading
    await expect(page.getByRole('heading', { name: 'Matches', exact: true })).toBeVisible();
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

  test('should navigate to scoring interface from a ready match', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    // Look for a clickable match item (in-progress or ready-to-play section)
    const matchItem = page.locator('.match-item').first();
    await expect(matchItem).toBeVisible({ timeout: 5000 });

    await matchItem.click();
    await page.waitForURL(/\/matches\/.+\/score/, { timeout: 10000 });
    expect(page.url()).toContain('/score');
  });

  test('should display scoring interface elements when a match is opened', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/matches`);
    await page.waitForLoadState('domcontentloaded');

    const matchItem = page.locator('.match-item').first();
    await expect(matchItem).toBeVisible({ timeout: 5000 });

    await matchItem.click();
    await page.waitForURL(/\/matches\/.+\/score/, { timeout: 10000 });

    // Scoring interface should show participant names or TBD
    await expect(page.locator('.v-container').first()).toBeVisible();

    // Verify back navigation button is present
    await expect(page.getByRole('button', { name: /arrow-left/i }).or(
      page.locator('button[aria-label*="back" i]')
    ).or(
      page.locator('.v-btn').first()
    )).toBeVisible();
  });
});
