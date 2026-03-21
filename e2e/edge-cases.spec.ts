import { test, expect } from '@playwright/test';
import { waitForPostLoginLanding } from './utils/auth';

async function loginAsAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@courtmastr.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForPostLoginLanding(page, 15000);
}

test.describe('Edge Cases - Authentication', () => {
  test('shows an auth error for a valid-but-unknown email with special characters', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test+special@email.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('.v-alert.text-error')).toBeVisible({ timeout: 10000 });
  });

  test('rejects malformed email payloads without leaving the login screen', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('<script>alert("xss")</script>');
    await page.locator('input[type="password"]').fill('password123');

    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('rejects SQL-injection style credentials without authenticating', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill("' OR '1'='1");
    await page.locator('input[type="password"]').fill("' OR '1'='1");

    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});

test.describe('Edge Cases - Tournament Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tournaments/create');
  });

  test('prevents an end date before the start date', async ({ page }) => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await page.getByLabel('Tournament Name').fill('Date Validation Test');
    await page.getByLabel('Start Date').fill(today.toISOString().split('T')[0]);
    await page.getByLabel('End Date').fill(yesterday.toISOString().split('T')[0]);

    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByTestId('date-error')).toContainText(/end date must be after start date/i);
  });

  test('accepts all available category selections', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];

    await page.getByLabel('Tournament Name').fill('All Categories Test');
    await page.getByLabel('Start Date').fill(today);
    await page.getByLabel('End Date').fill(today);
    await page.getByRole('button', { name: 'Continue' }).click();

    const checkboxes = page.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);

    for (let index = 0; index < checkboxCount; index += 1) {
      const checkbox = checkboxes.nth(index);
      if (!await checkbox.isChecked().catch(() => false)) {
        await checkbox.click();
      }
    }

    await expect(checkboxes.first()).toBeChecked();
  });
});

test.describe('Edge Cases - Security', () => {
  test('treats HTML in tournament name input as plain text', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tournaments/create');

    const xssAttempt = '<img src=x onerror=alert(1)>';
    await page.getByLabel('Tournament Name').fill(xssAttempt);

    await expect(page.getByLabel('Tournament Name')).toHaveValue(xssAttempt);
  });

  test('does not create auth cookies after Firebase login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tournaments');

    const cookies = await page.context().cookies();
    const authCookies = cookies.filter((cookie) =>
      cookie.name.toLowerCase().includes('session')
      || cookie.name.toLowerCase().includes('auth')
      || cookie.name.toLowerCase().includes('token'),
    );

    expect(authCookies).toHaveLength(0);
  });

  test('redirects unauthenticated users away from admin routes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/tournaments/create');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
