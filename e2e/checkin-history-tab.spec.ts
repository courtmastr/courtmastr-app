import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.describe('Check-In History Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Firebase Auth uses IndexedDB — must do a fresh UI login every test
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@courtmastr.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/tournaments', { timeout: 15000 });

    const tournamentId = getTournamentId();
    await page.goto(`/tournaments/${tournamentId}/checkin`);
    // Wait for the hero card to appear
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('History tab is visible alongside Check In tab', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Check In' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'History' })).toBeVisible();
  });

  test('Check In tab is active by default', async ({ page }) => {
    const checkinTab = page.getByRole('tab', { name: 'Check In' });
    await expect(checkinTab).toHaveClass(/v-tab--selected/);
  });

  test('clicking History tab shows date nav and Refresh button', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();

    // Date nav bar visible with Today label
    await expect(page.getByText(/today/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous day' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next day' })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('Next day button is disabled when viewing today', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled();
  });

  test('Previous day button navigates back one day', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Previous day' }).click();

    // "Today" suffix should disappear
    await expect(page.getByText('· Today')).not.toBeVisible();
    // Next day button is now enabled
    await expect(page.getByRole('button', { name: 'Next day' })).toBeEnabled();
  });

  test('Next day button navigates forward after going back', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByRole('button', { name: 'Next day' })).toBeEnabled();
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page.getByText(/today/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled();
  });

  test('Rapid/Bulk toggle is hidden on History tab', async ({ page }) => {
    const toggle = page.locator('.frontdesk-checkin__mode-toggle');
    await expect(toggle).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(toggle).not.toBeVisible();
  });

  test('Rapid/Bulk toggle reappears on Check In tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('tab', { name: 'Check In' }).click();

    const toggle = page.locator('.frontdesk-checkin__mode-toggle');
    await expect(toggle).toBeVisible();
  });

  test('shows empty state or rows on History tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    // Either empty state or rows should be present (depending on seeded data)
    const emptyState = page.getByText('No check-ins recorded for this day');
    const hasRows = page.locator('.checkin-history-panel__row');

    const rowCount = await hasRows.count();
    if (rowCount === 0) {
      await expect(emptyState).toBeVisible();
    } else {
      await expect(hasRows.first()).toBeVisible();
    }
  });

  test('Refresh button re-fetches without page reload', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();
    // Record current URL before refresh
    const urlBefore = page.url();
    await page.getByRole('button', { name: /refresh/i }).click();
    // Still on same page
    expect(page.url()).toBe(urlBefore);
    // Panel still visible
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('empty state shown for far-past day with no check-ins', async ({ page }) => {
    await page.getByRole('tab', { name: 'History' }).click();

    // Navigate back 30 days
    const prevBtn = page.getByRole('button', { name: 'Previous day' });
    for (let i = 0; i < 30; i++) {
      await prevBtn.click();
    }
    await page.getByRole('button', { name: /refresh/i }).click();
    await page.waitForTimeout(800);

    await expect(page.getByText('No check-ins recorded for this day')).toBeVisible();
  });
});
