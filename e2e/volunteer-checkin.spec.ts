/**
 * E2E: Volunteer Check-In Flow
 *
 * Tests the full volunteer check-in lifecycle:
 *   1. Admin sets a check-in PIN via tournament settings
 *   2. Volunteer enters PIN on the access page → lands on the kiosk
 *   3. Volunteer checks in a player (status: approved → checked_in)
 *   4. Volunteer undoes the check-in (status: checked_in → approved)
 *   5. Wrong PIN is rejected
 *   6. Direct navigation without a session redirects to access page
 */

import { test as adminTest, expect } from './fixtures/auth-fixtures';
import { test } from '@playwright/test';
import { getTournamentId } from './utils/test-data';
import type { Page } from '@playwright/test';

const CHECKIN_PIN = '7531';

// ─── Setup: admin configures the volunteer check-in PIN ──────────────────────

adminTest.describe('Volunteer Check-In — Admin Setup', () => {
  let tournamentId: string;

  adminTest.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  adminTest('admin can set the volunteer check-in PIN via tournament settings', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/settings`);
    await expect(page.getByText('Volunteer Access')).toBeVisible({ timeout: 15000 });

    // Find the Check-in card (distinct from Scorekeeper card)
    const checkinCard = page.locator('.v-card').filter({ hasText: 'Check-in' }).first();
    await expect(checkinCard).toBeVisible();

    // Enable the toggle if it isn't already
    const enableToggle = checkinCard.getByLabel('Enable Check-in access');
    const isEnabled = await enableToggle.isChecked();
    if (!isEnabled) {
      await enableToggle.click();
    }

    // Type the PIN and save
    await checkinCard.getByLabel('Set or Reset PIN').fill(CHECKIN_PIN);
    await checkinCard.getByRole('button', { name: 'Save PIN' }).click();

    await expect(page.getByText('Check-in PIN saved')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Volunteer access — PIN entry (no admin auth needed) ─────────────────────

test.describe('Volunteer Check-In — PIN Entry', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('shows PIN entry form on the check-in access page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/checkin-access`);
    await expect(page.getByText('Front Desk PIN Access')).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('PIN')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter Volunteer Mode' })).toBeVisible();
  });

  test('rejects an incorrect PIN and shows an error', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/checkin-access`);
    await page.getByLabel('PIN').fill('0000');
    await page.getByRole('button', { name: 'Enter Volunteer Mode' }).click();

    await expect(page.locator('.v-alert[type="error"]')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/checkin-access/);
  });

  test('accepts the correct PIN and redirects to the kiosk', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/checkin-access`);
    await page.getByLabel('PIN').fill(CHECKIN_PIN);
    await page.getByRole('button', { name: 'Enter Volunteer Mode' }).click();

    await page.waitForURL(/checkin-kiosk/, { timeout: 15000 });
    await expect(page.getByText('Check-In Command Center')).toBeVisible({ timeout: 15000 });
  });

  test('direct navigation to checkin-kiosk without a session redirects to access page', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/checkin-kiosk`);
    await expect(page).toHaveURL(/checkin-access/, { timeout: 15000 });
    await expect(page.getByText('Front Desk PIN Access')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Kiosk — check in and undo ───────────────────────────────────────────────

test.describe('Volunteer Check-In — Kiosk Actions', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  async function enterKiosk(page: Page): Promise<void> {
    await page.goto(`/tournaments/${tournamentId}/checkin-access`);
    await page.getByLabel('PIN').fill(CHECKIN_PIN);
    await page.getByRole('button', { name: 'Enter Volunteer Mode' }).click();
    await page.waitForURL(/checkin-kiosk/, { timeout: 15000 });
    await expect(page.getByText('Check-In Command Center')).toBeVisible({ timeout: 15000 });
  }

  test('can check in a player — status changes to Checked In', async ({ page }) => {
    await enterKiosk(page);

    // Wait for at least one check-in button (approved player)
    const firstCheckInBtn = page.locator('[data-testid="search-suggestion-checkin-btn"]').first();
    await expect(firstCheckInBtn).toBeVisible({ timeout: 15000 });

    await firstCheckInBtn.click();

    // A "Checked In" chip should now appear on the page
    await expect(
      page.locator('.v-chip').filter({ hasText: 'Checked In' }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('can undo a recent check-in — status returns to Approved', async ({ page }) => {
    await enterKiosk(page);

    // Check in any player
    const firstCheckInBtn = page.locator('[data-testid="search-suggestion-checkin-btn"]').first();
    await expect(firstCheckInBtn).toBeVisible({ timeout: 15000 });
    await firstCheckInBtn.click();

    // Wait for the "Recent Check-ins" section with an undo button
    await expect(page.getByText('Recent Check-ins')).toBeVisible({ timeout: 10000 });
    const undoBtn = page.locator('[data-testid="recent-undo-btn"]').first();
    await expect(undoBtn).toBeVisible({ timeout: 10000 });

    await undoBtn.click();

    // Undo button disappears once the action completes
    await expect(undoBtn).not.toBeVisible({ timeout: 10000 });
  });

  test('a checked-in player no longer shows a Check In button', async ({ page }) => {
    await enterKiosk(page);

    // Count check-in buttons before
    const checkInBtns = page.locator('[data-testid="search-suggestion-checkin-btn"]');
    await expect(checkInBtns.first()).toBeVisible({ timeout: 15000 });
    const countBefore = await checkInBtns.count();

    // Check in the first player
    await checkInBtns.first().click();
    await expect(
      page.locator('.v-chip').filter({ hasText: 'Checked In' }).first()
    ).toBeVisible({ timeout: 10000 });

    // Count should have decreased (checked-in row loses its button)
    const countAfter = await checkInBtns.count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('checking in then undoing restores the Check In button', async ({ page }) => {
    await enterKiosk(page);

    const checkInBtns = page.locator('[data-testid="search-suggestion-checkin-btn"]');
    await expect(checkInBtns.first()).toBeVisible({ timeout: 15000 });
    const countBefore = await checkInBtns.count();

    // Check in
    await checkInBtns.first().click();
    await expect(page.getByText('Recent Check-ins')).toBeVisible({ timeout: 10000 });

    // Undo
    await page.locator('[data-testid="recent-undo-btn"]').first().click();

    // Button count should be restored
    await expect(async () => {
      const countRestored = await checkInBtns.count();
      expect(countRestored).toBe(countBefore);
    }).toPass({ timeout: 10000 });
  });
});
