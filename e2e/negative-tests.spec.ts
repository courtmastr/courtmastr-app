import { test, expect } from '@playwright/test';
import { LoginPage, TournamentCreatePage } from './models/index';
import { waitForPostLoginLanding } from './utils/auth';

async function loginAsAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@courtmastr.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForPostLoginLanding(page, 10000);
}

test.describe('Negative Test Cases', () => {
  test.describe('Authentication', () => {
    test('shows an error for invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('invalid@email.com', 'wrongpassword');

      await loginPage.expectError(/invalid|error|failed|not found|no account/i);
    });

    test('disables sign-in when email is empty', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('');
      await loginPage.passwordInput.fill('password123');

      await expect(loginPage.signInButton).toBeDisabled();
    });

    test('redirects unauthenticated users from protected routes', async ({ page }) => {
      await page.goto('/tournaments/create');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Tournament Creation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('disables continue with an empty tournament name', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();
      await createPage.descriptionInput.fill('Test Description');
      await createPage.locationInput.fill('Test Location');

      await expect(createPage.continueButton).toBeDisabled();
    });

    test('requires at least one category before continuing', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();

      const today = new Date().toISOString().split('T')[0];
      await createPage.fillBasicInfo('Test', 'Description', 'Location', today, today);
      await createPage.selectFormat('single_elimination');

      await expect(createPage.continueButton).toBeDisabled();
    });

    test('keeps the final court undeletable', async ({ page }) => {
      const createPage = new TournamentCreatePage(page);
      await createPage.goto();

      const today = new Date().toISOString().split('T')[0];
      await createPage.fillBasicInfo('Test', 'Description', 'Location', today, today);
      await createPage.selectFormat('single_elimination');
      await createPage.selectCategories(["Men's Singles"]);
      await createPage.continueButton.click();
      await page.waitForTimeout(500);

      const deleteCourtButton = page.locator('button:has(.mdi-delete)').first();
      await expect(deleteCourtButton).toBeVisible();
      await expect(deleteCourtButton).toBeDisabled();
      await expect(createPage.continueButton).toBeEnabled();
    });
  });

  test.describe('Public Pages', () => {
    test('shows tournament not found for a non-existent bracket', async ({ page }) => {
      await page.goto('/tournaments/non-existent-id/bracket');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText(/tournament not found/i)).toBeVisible({ timeout: 5000 });
    });

    test('redirects a non-existent live route into the empty public schedule shell', async ({ page }) => {
      await page.goto('/tournaments/non-existent-id/live');
      await page.waitForURL(/\/tournaments\/non-existent-id\/schedule/);
      await expect(page.getByText(/Public Schedule Display|No upcoming matches yet\./i).first()).toBeVisible({ timeout: 5000 });
    });

    test('shows an error for an invalid scoring route', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill('scorekeeper@courtmastr.com');
      await page.locator('input[type="password"]').fill('score123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await waitForPostLoginLanding(page);

      await page.goto('/tournaments/non-existent-id/matches/invalid-match/score');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(/tournament not found|match not found/i).first()).toBeVisible({ timeout: 5000 });
    });
  });
});
