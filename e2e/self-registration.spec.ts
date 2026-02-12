import { test, expect, BrowserContext } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.describe.configure({ mode: 'serial' });

test.describe('Self-Registration', () => {
  let tournamentId: string;

  test.beforeAll(async ({ browser }) => {
    tournamentId = await getTournamentId();

    // Admin setup: change tournament status to 'registration' so the self-reg form is open.
    // Firebase auth is in IndexedDB (not in Playwright storageState) — must do a fresh UI login.
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      // Fresh login
      await adminPage.goto('/login');
      await adminPage.getByLabel('Email').fill('admin@courtmaster.local');
      await adminPage.locator('input[type="password"]').fill('admin123');
      await adminPage.getByRole('button', { name: 'Sign In' }).click();
      await adminPage.waitForURL('/tournaments', { timeout: 15000 });

      await adminPage.goto(`/tournaments/${tournamentId}`);
      await adminPage.waitForLoadState('domcontentloaded');

      // Click the "Manage" menu to reveal status options
      const manageBtn = adminPage.getByRole('button', { name: /manage/i });
      await expect(manageBtn).toBeVisible({ timeout: 5000 });
      await manageBtn.click();
      await adminPage.waitForTimeout(500);

      // Click "Open Registration" if tournament is currently draft.
      const openRegItem = adminPage.getByRole('menuitem', { name: /open registration/i })
        .or(adminPage.getByText('Open Registration'));
      if (await openRegItem.isVisible()) {
        await openRegItem.click();
        await adminPage.waitForTimeout(1000);
      }
    } finally {
      await adminPage.close();
      await adminContext.close();
    }
  });

  test('should load the self-registration route', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Page should load — either the form, a "closed" message, or tournament info
    await expect(page.locator('.v-container').first()).toBeVisible();
  });

  test('should display tournament info on self-registration page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Tournament name should be visible
    await expect(page.locator('.v-card-title').first()).toBeVisible();
  });

  test('should display registration form when registration is open', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Register for Tournament')).toBeVisible({ timeout: 10000 });
  });

  test('should show registration form fields when open', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Register for Tournament')).toBeVisible({ timeout: 10000 });

    // Form should have required fields
    await expect(page.getByLabel('First Name')).toBeVisible();
    await expect(page.getByLabel('Last Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('should keep submit button disabled until required fields are filled', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Register for Tournament')).toBeVisible({ timeout: 10000 });

    // Submit button is disabled when form is empty
    const submitBtn = page.getByRole('button', { name: /submit registration/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('should enable submit button after filling required fields and selecting category', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Register for Tournament')).toBeVisible({ timeout: 10000 });

    // Fill required fields
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('Registrant');
    await page.getByLabel('Email').fill(`selfreg-${Date.now()}@test.com`);

    // Select first available category
    const firstCheckbox = page.locator('.v-checkbox input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.check();

    // Submit button should now be enabled
    const submitBtn = page.getByRole('button', { name: /submit registration/i });
    await expect(submitBtn).toBeEnabled();
  });

  test('should submit registration and show confirmation', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Register for Tournament')).toBeVisible({ timeout: 10000 });

    // Fill all required fields
    await page.getByLabel('First Name').fill('SelfReg');
    await page.getByLabel('Last Name').fill('Tester');
    await page.getByLabel('Email').fill(`selfreg-${Date.now()}@test.com`);

    // Select first category
    const firstCheckbox = page.locator('.v-checkbox input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.check();

    // Submit
    await page.getByRole('button', { name: /submit registration/i }).click();
    await page.waitForTimeout(2000);

    // Should show success message
    await expect(
      page.getByText(/registration submitted/i).or(page.getByText(/pending approval/i))
    ).toBeVisible({ timeout: 10000 });
  });
});
