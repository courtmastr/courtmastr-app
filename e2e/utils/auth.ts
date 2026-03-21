import { expect, type Page } from '@playwright/test';

export const POST_LOGIN_URL_RE = /\/(dashboard|tournaments)(?:\/?|[?#].*)?$/;

export const waitForPostLoginLanding = async (
  page: Page,
  timeout: number = 15000,
): Promise<void> => {
  await expect.poll(() => page.url(), { timeout }).toMatch(POST_LOGIN_URL_RE);
};

export const loginWithCredentials = async (
  page: Page,
  email: string,
  password: string,
  timeout: number = 15000,
): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForPostLoginLanding(page, timeout);
};

export const loginAsAdminUi = async (page: Page, timeout?: number): Promise<void> => {
  await loginWithCredentials(page, 'admin@courtmastr.com', 'admin123', timeout);
};
