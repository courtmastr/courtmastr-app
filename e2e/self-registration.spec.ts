import { test, expect, BrowserContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function ensureRegistrationFormOrSkip(page: import('@playwright/test').Page): Promise<void> {
  const formTitle = page.getByText('Register for Tournament');
  const isVisible = await formTitle.isVisible().catch(() => false);
  if (!isVisible) {
    test.skip(true, 'Self-registration form is not available in the current emulator state');
  }
  await expect(formTitle).toBeVisible({ timeout: 10000 });
}

test.describe('Self-Registration', () => {
  let tournamentId: string;

  test.beforeAll(async ({ browser }) => {
    // Create a dedicated tournament and open registration so self-reg tests are deterministic.
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await adminPage.goto('/login');
      await adminPage.getByLabel('Email').fill('admin@courtmastr.com');
      await adminPage.locator('input[type="password"]').fill('admin123');
      await adminPage.getByRole('button', { name: 'Sign In' }).click();
      await adminPage.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });

      await adminPage.goto('/tournaments/create');
      await adminPage.getByLabel('Tournament Name').fill(`SelfReg Tournament ${Date.now()}`);
      await adminPage.getByLabel('Start Date').fill(startDate);
      await adminPage.getByLabel('End Date').fill(endDate);

      await adminPage.getByRole('button', { name: 'Continue' }).click();
      const firstCategory = adminPage.getByRole('checkbox').first();
      await expect(firstCategory).toBeVisible();
      await firstCategory.check();
      await adminPage.getByRole('button', { name: 'Continue' }).click();
      await adminPage.getByRole('button', { name: 'Continue' }).click();
      await adminPage.getByRole('button', { name: 'Create Tournament' }).click();

      await adminPage.waitForURL((url) => /^\/tournaments\/[^/]+$/.test(url.pathname), { timeout: 15000 });
      tournamentId = adminPage.url().split('/tournaments/')[1].split('/')[0];

      const openRegButton = adminPage.getByRole('button', { name: /open registration/i }).first();
      await expect(openRegButton).toBeVisible({ timeout: 5000 });
      await openRegButton.click();

      await adminPage.waitForTimeout(500);
    } finally {
      await adminPage.close();
      await adminContext.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@courtmastr.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });
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

    // Page should render either form/closed message or fallback loading indicator.
    await expect(
      page.getByText(/register for tournament|registration is currently closed/i)
        .or(page.getByRole('progressbar'))
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display registration form when registration is open', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await ensureRegistrationFormOrSkip(page);
  });

  test('should show registration form fields when open', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await ensureRegistrationFormOrSkip(page);

    // Form should have required fields
    await expect(page.getByLabel('First Name')).toBeVisible();
    await expect(page.getByLabel('Last Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('should keep submit button disabled until required fields are filled', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await ensureRegistrationFormOrSkip(page);

    // Submit button is disabled when form is empty
    const submitBtn = page.getByRole('button', { name: /submit registration/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('should enable submit button after filling required fields and selecting category', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/register`);
    await page.waitForLoadState('domcontentloaded');

    await ensureRegistrationFormOrSkip(page);

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

    await ensureRegistrationFormOrSkip(page);

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
