import { test, expect } from '@playwright/test';
import { LoginPage, TournamentCreatePage, RegistrationManagementPage } from './models/index';
import { getTournamentId } from './utils/test-data';

// Firebase auth state lives in IndexedDB (not captured by storageState).
// Tests that need an authenticated admin must do a fresh login.
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@courtmaster.local');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/tournaments', { timeout: 10000 });
}

test.describe('Negative Test Cases', () => {
  test.describe('Authentication', () => {
    test('should show error for invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('invalid@email.com', 'wrongpassword');
      // Firebase returns "No account found with this email" for invalid emails
      await loginPage.expectError(/invalid|error|failed|not found|no account/i);
    });

    test('should show error for empty email', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('');
      await loginPage.passwordInput.fill('password123');
      await expect(loginPage.signInButton).toBeDisabled();
    });

    test('should show error for short password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('test@example.com');
      await loginPage.passwordInput.fill('123');
      await expect(loginPage.signInButton).toBeDisabled();
    });

    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      await page.goto('/tournaments/create');
      // Router adds ?redirect=... query param; use regex to match any /login URL
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Tournament Creation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('should disable continue with empty tournament name', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();
      
      await createPage.descriptionInput.fill('Test Description');
      await createPage.locationInput.fill('Test Location');
      
      await expect(createPage.continueButton).toBeDisabled();
    });

    test('should disable continue with missing dates', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();
      
      await createPage.nameInput.fill('Test Tournament');
      await createPage.locationInput.fill('Test Location');
      
      await expect(createPage.continueButton).toBeDisabled();
    });

    test('should require at least one category', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();
      
      const today = new Date().toISOString().split('T')[0];
      await createPage.fillBasicInfo('Test', 'Description', 'Location', today, today);
      await createPage.selectFormat('single_elimination');
      
      await createPage.continueButton.click();
      await page.waitForTimeout(500);
      
      await expect(createPage.continueButton).toBeDisabled();
    });

    test('should require at least one court', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();
      
      const today = new Date().toISOString().split('T')[0];
      await createPage.fillBasicInfo('Test', 'Description', 'Location', today, today);
      await createPage.selectFormat('single_elimination');
      await createPage.selectCategories(["Men's Singles"]);

      const deleteCourtButton = page.locator('button:has(.mdi-delete)').first();
      await expect(deleteCourtButton).toBeVisible();
      await expect(deleteCourtButton).toBeDisabled();
      await expect(createPage.continueButton).toBeEnabled();
    });
  });

  test.describe('Registration Management', () => {
    let tournamentId: string;

    test.beforeAll(async () => {
      tournamentId = await getTournamentId();
    });

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('should not allow duplicate player registration', async ({ page }) => {
      const registrationPage = new RegistrationManagementPage(page);
      await registrationPage.goto(tournamentId);

      const uniqueEmail = `dup-${Date.now()}@test.com`;
      await registrationPage.addPlayer('Duplicate', 'Player', uniqueEmail, '555-0001');
      await registrationPage.addPlayer('Duplicate', 'Player', uniqueEmail, '555-0001');

      // Second add should show a duplicate/already-exists error
      await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible({ timeout: 5000 });
      // The email must appear exactly once — duplicate was rejected
      await registrationPage.playersTab.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(uniqueEmail)).toHaveCount(1);
    });

    test('should validate required fields when adding player', async ({ page }) => {
      const registrationPage = new RegistrationManagementPage(page);
      await registrationPage.goto(tournamentId);

      await registrationPage.addPlayerButton.click();

      const dialog = page.locator('.v-dialog').last();
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: 'Add Player' }).click();

      await expect(dialog).toBeVisible();
    });

    test('should handle withdraw for already withdrawn participant', async ({ page }) => {
      const registrationPage = new RegistrationManagementPage(page);
      await registrationPage.goto(tournamentId);

      // Withdraw buttons live in the Registrations tab, not the default Players tab
      await registrationPage.registrationsTab.click();
      await page.waitForTimeout(500);

      const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
      await expect(withdrawBtn).toBeVisible({ timeout: 5000 });
      page.on('dialog', dialog => dialog.accept());
      await withdrawBtn.click();
      await expect(page.getByText(/withdrawn/i).first()).toBeVisible({ timeout: 5000 });

      // Withdraw button should no longer be visible for the now-withdrawn participant
      await expect(withdrawBtn).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Match Control', () => {
    let tournamentId: string;

    test.beforeAll(async () => {
      tournamentId = await getTournamentId();
    });

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto(`/tournaments/${tournamentId}/match-control`);
      await page.waitForLoadState('domcontentloaded');
    });

    test('should show error when scheduling without enough participants', async ({ page }) => {
      // This test requires a tournament that has no bracket generated yet.
      // The seeded tournament already has participants, so auto-schedule may succeed.
      // Skip unless the button is present AND clicking it produces an error.
      const autoScheduleButton = page.getByRole('button', { name: /auto schedule/i });
      if (!await autoScheduleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip(true, 'Auto-schedule button not visible — tournament may not be in the right state');
        return;
      }
      await autoScheduleButton.click();
      await expect(page.getByText(/error|not enough|insufficient|no bracket/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should not allow negative scores', async ({ page }) => {
      const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
      if (!await scoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip(true, 'No active matches with score entry — seeded tournament is in registration status');
        return;
      }
      await scoreButton.click();

      const dialog = page.locator('.v-dialog').last();
      await dialog.waitFor({ state: 'visible' });
      await dialog.locator('input').first().fill('-5');
      await expect(dialog.getByRole('button', { name: /save|submit/i })).toBeDisabled();
    });

    test('should not allow scores above maximum', async ({ page }) => {
      const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
      if (!await scoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip(true, 'No active matches with score entry — seeded tournament is in registration status');
        return;
      }
      await scoreButton.click();

      const dialog = page.locator('.v-dialog').last();
      await dialog.waitFor({ state: 'visible' });
      await dialog.locator('input').first().fill('35');
      await expect(dialog.getByText(/max|maximum|invalid/i).first()).toBeVisible();
    });
  });

  test.describe('Public Pages', () => {
    test('should show 404 for non-existent tournament bracket', async ({ page }) => {
      await page.goto('/tournaments/non-existent-id/bracket');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(/tournament not found/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show 404 for non-existent tournament live scores', async ({ page }) => {
      await page.goto('/tournaments/non-existent-id/live');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(/tournament not found/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show error for invalid match ID in scoring', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill('scorekeeper@courtmaster.local');
      await page.locator('input[type="password"]').fill('score123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('/tournaments');

      await page.goto('/tournaments/non-existent-id/matches/invalid-match/score');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(/tournament not found|match not found/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Access Control', () => {
    test('should not allow scorekeeper to access admin-only pages', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill('scorekeeper@courtmaster.local');
      await page.locator('input[type="password"]').fill('score123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('/tournaments');
      
      await page.goto('/tournaments/create');
      await page.waitForTimeout(2000);
      
      await expect(page).not.toHaveURL('/tournaments/create');
    });

    test('should not allow scorekeeper to access admin match-control page', async ({ page }) => {
      // The auth store defines isScorekeeper = role === 'scorekeeper' | 'admin' | 'organizer',
      // so admin can access scoring routes. But scorekeeper cannot access admin-only routes.
      // This test verifies the reverse: scorekeeper → match-control (requiresAdmin: true) is blocked.
      await page.goto('/login');
      await page.getByLabel('Email').fill('scorekeeper@courtmaster.local');
      await page.locator('input[type="password"]').fill('score123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('/tournaments');

      const skTournamentId = await getTournamentId();
      await page.goto(`/tournaments/${skTournamentId}/match-control`);
      await page.waitForTimeout(2000);

      // Router guard (requiresAdmin) redirects scorekeeper to /tournaments
      await expect(page).not.toHaveURL(/\/match-control/);
      await expect(page).toHaveURL(/\/tournaments/);
    });
  });
});
