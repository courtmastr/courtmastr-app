import { test, expect } from '@playwright/test';

test('basic page load test', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('CourtMaster').first()).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('tournaments page requires auth', async ({ page }) => {
  await page.goto('/tournaments');
  await page.waitForURL(/\/login/, { timeout: 5000 });
  await expect(page).toHaveURL(/\/login/);
});
