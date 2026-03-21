/**
 * P0 — Player Profile
 *
 * Verifies that the players list is accessible and the player profile
 * page renders correctly with the Match History section.
 *
 * Note: Seeded players exist in the /players collection with @seed.local emails.
 * Match history content depends on whether completed match_scores exist for the
 * seeded tournament. These tests cover the UI structure and graceful empty state.
 */

import { test, expect } from './fixtures/auth-fixtures';

const openFirstPlayerProfile = async (page: Parameters<typeof test>[0]['page']): Promise<void> => {
  const playerCard = page.getByTestId('player-list-card').first();
  await expect(playerCard).toBeVisible({ timeout: 10000 });
  await playerCard.click();
  await page.waitForURL(/\/players\/.+/, { timeout: 15000 });
};

test.describe('P0 - Player Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/players');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should show the players list page', async ({ page }) => {
    await expect(page.getByTestId('players-page-title')).toBeVisible({ timeout: 10000 });
  });

  test('should show at least one seeded player in the list', async ({ page }) => {
    await expect(page.getByTestId('player-list-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to a player profile when clicking a player link', async ({ page }) => {
    await openFirstPlayerProfile(page);

    await expect(page.locator('text=Player not found')).not.toBeVisible();
  });

  test('should show the Match History section on player profile', async ({ page }) => {
    await openFirstPlayerProfile(page);

    await expect(page.locator('text=Match History')).toBeVisible({ timeout: 10000 });
  });

  test('should show Wins stat on player profile', async ({ page }) => {
    await openFirstPlayerProfile(page);

    await expect(page.locator('text=Wins').first()).toBeVisible({ timeout: 10000 });
  });

  test('should resolve Match History into empty or populated state', async ({
    page,
  }) => {
    await openFirstPlayerProfile(page);

    const emptyState = page.locator('[data-testid="match-history-empty"]');
    const panels = page.locator('[data-testid="match-history-panels"]');

    await expect
      .poll(async () => {
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        const hasPanels = await panels.isVisible().catch(() => false);
        return hasEmpty || hasPanels;
      }, { timeout: 15000 })
      .toBe(true);
  });

  test('should handle browser back navigation from player profile', async ({ page }) => {
    await openFirstPlayerProfile(page);

    await page.goBack();
    await page.waitForURL(/\/players$/, { timeout: 10000 });
  });
});
