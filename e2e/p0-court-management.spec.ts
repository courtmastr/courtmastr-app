import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';
import type { Page } from '@playwright/test';

test.describe('P0 - Court Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  const addCourt = async (page: Page, courtName: string): Promise<void> => {
    await page.getByTestId('add-court-btn').click();
    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });
    const nameInput = dialog.getByTestId('court-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill(courtName);
    await dialog.getByTestId('save-court-btn').click();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/courts`);
    await expect(page.getByTestId('add-court-btn')).toBeVisible({ timeout: 10000 });
  });

  test('should display court management tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Courts \(\d+\)/ })).toBeVisible();
    await expect(page.getByTestId('add-court-btn')).toBeVisible();
  });

  test('should add new court', async ({ page }) => {
    const courtName = `New Test Court ${Date.now()}`;
    await addCourt(page, courtName);
    await expect(page.locator('.court-card', { hasText: courtName }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing court', async ({ page }) => {
    const originalName = `Editable Court ${Date.now()}`;
    await addCourt(page, originalName);
    const courtCard = page.locator('.court-card', { hasText: originalName }).first();
    await expect(courtCard).toBeVisible({ timeout: 10000 });
    await courtCard.getByTestId('edit-court-btn').first().click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    const updatedName = `Updated Court ${Date.now()}`;
    const nameInput = dialog.getByTestId('court-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill(updatedName);
    await dialog.getByTestId('save-court-btn').click();

    await expect(page.locator('.court-card', { hasText: updatedName }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should delete court', async ({ page }) => {
    const courtName = `Delete Court ${Date.now()}`;
    await addCourt(page, courtName);
    const courtCard = page.locator('.court-card', { hasText: courtName }).first();
    await expect(courtCard).toBeVisible({ timeout: 10000 });

    await courtCard.getByTestId('delete-court-btn').first().click();

    const dialog = page.locator('.v-dialog').filter({ hasText: 'Delete Court?' }).last();
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('.court-card', { hasText: courtName })).toHaveCount(0, { timeout: 10000 });
  });

  test('should change court status to maintenance', async ({ page }) => {
    const courtName = `Maintenance Court ${Date.now()}`;
    await addCourt(page, courtName);
    const courtCard = page.locator('.court-card', { hasText: courtName }).first();
    await expect(courtCard).toBeVisible({ timeout: 10000 });
    await courtCard.getByRole('button', { name: /Set Maintenance|Set Available/ }).first().click();

    await expect(courtCard.getByRole('button', { name: 'Set Available' })).toBeVisible();
  });
});
