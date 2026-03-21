import { test, expect } from '@playwright/test';
import { POST_LOGIN_URL_RE, waitForPostLoginLanding } from './utils/auth';

test.describe('User Registration (/register)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
  });

  test('should display all registration form fields', async ({ page }) => {
    await expect(page.getByLabel('Display Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel(/^Password$/)).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
  });

  test('should limit public signup to player accounts', async ({ page }) => {
    await expect(page.getByText(/player accounts are created here/i)).toBeVisible();
    await expect(page.getByLabel(/i am a/i)).toHaveCount(0);
    await expect(page.getByText(/tournament organizer/i)).toHaveCount(0);
    await expect(page.getByText(/scorekeeper/i)).toHaveCount(0);
  });

  test('should have terms checkbox', async ({ page }) => {
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('should keep Create Account button disabled when form is empty', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /create account/i });
    await expect(createBtn).toBeDisabled();
  });

  test('should keep Create Account button disabled without terms acceptance', async ({ page }) => {
    await page.getByLabel('Display Name').fill('Test User');
    await page.getByLabel('Email').fill(`newuser-${Date.now()}@test.com`);
    await page.getByLabel(/^Password$/).fill('password123');
    await page.getByLabel('Confirm Password').fill('password123');
    // Terms NOT checked

    const createBtn = page.getByRole('button', { name: /create account/i });
    await expect(createBtn).toBeDisabled();
  });

  test('should show password mismatch error', async ({ page }) => {
    await page.getByLabel(/^Password$/).fill('password123');
    await page.getByLabel('Confirm Password').fill('different456');

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should show password strength indicator', async ({ page }) => {
    await page.getByLabel(/^Password$/).fill('weak');
    await expect(page.getByText(/too short|weak|fair|strong/i)).toBeVisible();
  });

  test('should enable Create Account button with valid form data', async ({ page }) => {
    await page.getByLabel('Display Name').fill('Valid User');
    await page.getByLabel('Email').fill(`validuser-${Date.now()}@test.com`);
    await page.getByLabel(/^Password$/).fill('SecurePass123');
    await page.getByLabel('Confirm Password').fill('SecurePass123');

    // Accept terms
    const termsCheckbox = page.getByRole('checkbox');
    await termsCheckbox.check();

    const createBtn = page.getByRole('button', { name: /create account/i });
    await expect(createBtn).toBeEnabled();
  });

  test('should register a new account and redirect to tournaments', async ({ page }) => {
    const uniqueEmail = `e2e-user-${Date.now()}@courtmastr.com`;

    await page.getByLabel('Display Name').fill('E2E Test User');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel(/^Password$/).fill('TestPass123!');
    await page.getByLabel('Confirm Password').fill('TestPass123!');

    // Accept terms
    await page.getByRole('checkbox').check();

    // Submit
    await page.getByRole('button', { name: /create account/i }).click();

    await waitForPostLoginLanding(page, 15000);
    await expect(page).toHaveURL(POST_LOGIN_URL_RE);
  });

  test('should have a link back to the login page', async ({ page }) => {
    // v-btn with to="/login" renders as an <a> (link role), not a <button>
    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
