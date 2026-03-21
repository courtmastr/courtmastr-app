/**
 * P0 — Import Email Validation
 *
 * Verifies that the CSV player import rejects rows without an email address
 * and accepts rows that include a valid email.
 *
 * Email is required since it is the primary key for global player identity
 * linking across tournaments.
 */

import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

const HEADER =
  'First Name,Last Name,Email,Phone,Skill Level (1-10),Category,Partner First Name,Partner Last Name,Partner Email,Partner Phone,Partner Skill Level (1-10)';

test.describe("P0 - Import Email Validation", () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/registrations`);
    await page.waitForLoadState('domcontentloaded');

    // Open the import dialog
    const importBtn = page.getByRole('button', { name: /import/i }).first();
    await importBtn.click();
    await page.locator('.v-dialog').last().waitFor({ state: 'visible', timeout: 10000 });
  });

  test('should show error when email is missing from a CSV row', async ({ page }) => {
    const dialog = page.locator('.v-dialog').last();

    // Switch to the Paste tab if present
    const pasteTab = dialog.getByRole('tab', { name: /paste/i });
    if (await pasteTab.isVisible()) {
      await pasteTab.click();
    }

    // Paste a row without email (column 3 empty)
    const pasteArea = dialog.locator('textarea').first();
    await pasteArea.fill(
      `${HEADER}\nJohn,Doe,,555-1234,7,,,,,,`
    );

    await dialog.getByRole('button', { name: /preview/i }).click();

    // Should show an email-required error
    await expect(dialog.locator('text=Email is required')).toBeVisible({ timeout: 5000 });
  });

  test('should accept a CSV row that includes a valid email', async ({ page }) => {
    const dialog = page.locator('.v-dialog').last();

    const pasteTab = dialog.getByRole('tab', { name: /paste/i });
    if (await pasteTab.isVisible()) {
      await pasteTab.click();
    }

    const pasteArea = dialog.locator('textarea').first();
    await pasteArea.fill(
      `${HEADER}\nJane,Smith,jane.import.test@example.com,555-9999,6,,,,,,`
    );

    await dialog.getByRole('button', { name: /preview/i }).click();

    // The "Email is required" error should not be present
    await expect(dialog.locator('text=Email is required')).not.toBeVisible({ timeout: 5000 });

    // A valid preview row should appear
    await expect(dialog.locator('text=Jane').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show error when partner email is missing for a doubles row', async ({ page }) => {
    const dialog = page.locator('.v-dialog').last();

    const pasteTab = dialog.getByRole('tab', { name: /paste/i });
    if (await pasteTab.isVisible()) {
      await pasteTab.click();
    }

    const pasteArea = dialog.locator('textarea').first();
    // Partner first+last name present, but partner email missing
    await pasteArea.fill(
      `${HEADER}\nAlice,Smith,alice.test@example.com,,7,,Bob,Jones,,,7`
    );

    await dialog.getByRole('button', { name: /preview/i }).click();

    await expect(dialog.locator('text=Partner Email is required')).toBeVisible({ timeout: 5000 });
  });
});
