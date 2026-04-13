/**
 * E2E tests: Pool Cut & Advance to Elimination
 *
 * Covers the complete "Advance to Elimination" feature for pool_to_elimination
 * tournaments where all pool matches are complete and the director needs to
 * choose N players to advance to the elimination bracket.
 *
 * Test groups:
 *   1. Banner visibility
 *   2. Dialog interaction (read-only — shared tournament, reseeded before suite)
 *   3. Generate Bracket (mutates category — uses a separate tournament)
 *
 * Expected global ranking for 12-player, 3-pool scenario (courtmaster_default
 * points: win=2, loss=1, ties broken alphabetically):
 *   Rank 1–3:  Alice, Eva, Ivan   (3 wins each, matchPoints=6)
 *   Rank 4–6:  Ben, Frank, Julia  (2 wins each, matchPoints=5)
 *   Rank 7–9:  Carlos, Greg, Kevin (1 win each, matchPoints=4)
 *   Rank 10–12: David, Henry, Lily  (0 wins each, matchPoints=3)
 *
 * Default N = nearestBracketSize(12) = 8 → 8 advancing, 4 eliminated.
 * Quick-pick chips: 2, 4, 8, All.
 */

import { test, expect } from './fixtures/auth-fixtures';
import type { Page } from '@playwright/test';
import { seedPoolCutScenario, seedPoolCutGenerateScenario, type PoolCutScenario } from './utils/pool-cut-scenarios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the categories page and wait for content to load. */
async function goToCategories(page: Page, tournamentId: string) {
  await page.goto(`/tournaments/${tournamentId}/categories`);
  await expect(page.getByRole('heading', { name: /Categories/i })).toBeVisible({ timeout: 20000 });
}

/** Open the Advance to Elimination dialog and wait for rankings to load. */
async function openDialog(page: Page, tournamentId: string) {
  await goToCategories(page, tournamentId);
  await expect(page.getByRole('button', { name: 'Advance to Elimination' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Advance to Elimination' }).click();
  const dialog = page.locator('.v-dialog').last();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  // Wait for the async pool-ranking fetch to finish
  await expect(dialog.getByText('Loading pool rankings…')).not.toBeVisible({ timeout: 20000 });
  return dialog;
}

// ─── Suite 1: Banner ──────────────────────────────────────────────────────────

test.describe('Pool Cut — Banner', () => {
  let scenario: PoolCutScenario;

  test.beforeAll(async () => {
    scenario = await seedPoolCutScenario();
  });

  test('shows "Pool Play Complete — Ready to advance!" banner for a pool_to_elimination category with completed pools', async ({ page }) => {
    await goToCategories(page, scenario.tournamentId);
    await expect(page.getByText('Pool Play Complete — Ready to advance!')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Advance to Elimination' })).toBeVisible();
  });

  test('banner shows helper text about choosing advancing player count', async ({ page }) => {
    await goToCategories(page, scenario.tournamentId);
    await expect(page.getByText('Choose how many players advance to the elimination bracket.')).toBeVisible({ timeout: 20000 });
  });
});

// ─── Suite 2: Dialog — read-only interactions ─────────────────────────────────

test.describe('Pool Cut — Dialog', () => {
  let scenario: PoolCutScenario;

  test.beforeAll(async () => {
    scenario = await seedPoolCutScenario();
  });

  // -- Dialog open / close ---------------------------------------------------

  test('clicking "Advance to Elimination" opens the dialog', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await expect(dialog.getByText(/Advance to Elimination/)).toBeVisible();
  });

  test('Cancel button closes the dialog without generating a bracket', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    // Banner still present (bracket NOT generated)
    await expect(page.getByText('Pool Play Complete — Ready to advance!')).toBeVisible({ timeout: 5000 });
  });

  // -- Ranked table defaults -------------------------------------------------

  test('dialog shows 8 "Advances" chips by default (N=8 = nearestBracketSize(12))', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    const advancingChips = dialog.locator('.v-chip').filter({ hasText: /^Advances$/ });
    await expect(advancingChips).toHaveCount(scenario.defaultAdvancingCount, { timeout: 10000 });
  });

  test('dialog shows 4 "Eliminated" chips by default (12 - 8 = 4)', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    const eliminatedChips = dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ });
    await expect(eliminatedChips).toHaveCount(scenario.totalPlayers - scenario.defaultAdvancingCount, { timeout: 10000 });
  });

  test('CUTLINE separator is visible between advancing and eliminated rows', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await expect(dialog.getByText(/CUTLINE/)).toBeVisible({ timeout: 10000 });
    // Shows correct eliminated count next to cutline
    await expect(dialog.getByText(/4 players? eliminated/i)).toBeVisible();
  });

  // -- Format auto-detection -------------------------------------------------

  test('format chip shows "Single Elimination" for default N=8 (perfect bracket)', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    // 8 is in PERFECT_BRACKET_SIZES → Single Elimination, green chip
    await expect(dialog.getByText('Single Elimination')).toBeVisible({ timeout: 10000 });
  });

  test('format chip shows "Double Elimination" when N is a non-perfect-bracket size', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    // Click the "All" chip → N=12, which is NOT a perfect bracket → Double Elimination
    await dialog.locator('.v-chip').filter({ hasText: 'All' }).click();
    await expect(dialog.getByText('Double Elimination')).toBeVisible({ timeout: 5000 });
  });

  // -- Quick-pick chips ------------------------------------------------------

  test('clicking quick-pick chip "4" advances 4 players', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.locator('.v-chip').filter({ hasText: /^4$/ }).first().click();
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(4, { timeout: 5000 });
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ })).toHaveCount(8, { timeout: 5000 });
  });

  test('clicking quick-pick chip "2" advances 2 players', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.locator('.v-chip').filter({ hasText: /^2$/ }).first().click();
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(2, { timeout: 5000 });
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ })).toHaveCount(10, { timeout: 5000 });
  });

  test('clicking quick-pick chip "All" advances all 12 players and hides cutline', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.locator('.v-chip').filter({ hasText: 'All' }).click();
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(12, { timeout: 5000 });
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ })).toHaveCount(0, { timeout: 5000 });
    // No cutline when everyone advances
    await expect(dialog.getByText(/CUTLINE/)).not.toBeVisible();
  });

  // -- ± stepper buttons -----------------------------------------------------

  test('minus button decreases advancing count by 1', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    // Default is 8. Click minus once → should advance 7.
    await dialog.locator('button:has(.mdi-minus)').click();
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(7, { timeout: 5000 });
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ })).toHaveCount(5, { timeout: 5000 });
  });

  test('plus button increases advancing count by 1', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    // Default is 8. Click minus then plus → back to 8.
    await dialog.locator('button:has(.mdi-minus)').click();
    await dialog.locator('button:has(.mdi-plus)').click();
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(8, { timeout: 5000 });
  });

  // -- Ranking mode ----------------------------------------------------------

  test('switching to "Pool Rank → then Global" radio re-orders the table', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    // In pool_first_global mode: all pool rank-1s beat all rank-2s regardless of global score.
    await dialog.getByLabel('Pool Rank → then Global').click();
    // Table should still show 8 advancing (mode doesn't change N, only sort order)
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(8, { timeout: 5000 });
    // First row should be a pool rank 1 player (Alice, Eva, or Ivan)
    const firstPlayerCell = dialog.locator('tbody tr').first().locator('td').nth(1);
    await expect(firstPlayerCell).toContainText(/Alice|Eva|Ivan/);
  });

  test('switching to "Top N per Pool" changes counter label to "Qualifiers per Pool"', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.getByLabel('Top N per Pool').click();
    await expect(dialog.getByText('Qualifiers per Pool')).toBeVisible({ timeout: 5000 });
  });

  test('Top N per Pool with N=2 advances 6 players (2 per pool × 3 pools)', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    await dialog.getByLabel('Top N per Pool').click();
    // Click quick-pick chip "2" to set qualifiersPerPool=2
    await dialog.locator('.v-chip').filter({ hasText: /^2$/ }).first().click();
    // 2 per pool × 3 pools = 6 advancing
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Advances$/ })).toHaveCount(6, { timeout: 5000 });
    await expect(dialog.locator('.v-chip').filter({ hasText: /^Eliminated$/ })).toHaveCount(6, { timeout: 5000 });
  });

  test('Generate Bracket button is enabled when pool is complete and N ≥ 2', async ({ page }) => {
    const dialog = await openDialog(page, scenario.tournamentId);
    const generateBtn = dialog.getByRole('button', { name: /Generate Bracket/i });
    await expect(generateBtn).toBeEnabled({ timeout: 10000 });
  });
});

// ─── Suite 3: Generate Bracket (mutates state — separate tournament) ──────────

test.describe('Pool Cut — Generate Bracket', () => {
  let genScenario: PoolCutScenario;

  test.beforeAll(async () => {
    // Seed a fresh separate tournament so this test can safely call generatePoolEliminationBracket
    // without affecting the read-only tests above.
    genScenario = await seedPoolCutGenerateScenario();
  });

  test('clicking Generate Bracket creates bracket, shows success toast, and closes dialog', async ({ page }) => {
    const dialog = await openDialog(page, genScenario.tournamentId);

    // Use default N=8 and generate
    const generateBtn = dialog.getByRole('button', { name: /Generate Bracket/i });
    await expect(generateBtn).toBeEnabled({ timeout: 10000 });
    await generateBtn.click();

    // Success toast
    await expect(page.getByText(/Bracket generated/i)).toBeVisible({ timeout: 30000 });

    // Dialog auto-closes
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('banner disappears after bracket is generated (eliminationStageId now set)', async ({ page }) => {
    // Navigate to the categories page (bracket was already generated in the previous test)
    await goToCategories(page, genScenario.tournamentId);
    // The banner should NOT be visible because eliminationStageId is now set on the category
    await expect(page.getByText('Pool Play Complete — Ready to advance!')).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Advance to Elimination' })).not.toBeVisible();
  });
});
