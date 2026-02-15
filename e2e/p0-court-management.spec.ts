import { test, expect } from './fixtures/auth-fixtures';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Court Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}?tab=courts-manage`);
    await page.waitForSelector('text=Courts', { timeout: 10000 });
  });

  test('should display court management tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /courts/i })).toBeVisible();
    await expect(page.getByTestId('add-court-btn')).toBeVisible();
  });

  test('should add new court', async ({ page }) => {
    await page.getByTestId('add-court-btn').click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    const nameInput = dialog.getByTestId('court-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill('New Test Court');

    await dialog.getByTestId('save-court-btn').click();

    await expect(page.getByText('New Test Court')).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing court', async ({ page }) => {
    const courtCard = page.locator('.v-card', { hasText: 'Court 1' }).first();
    await courtCard.getByTestId('edit-court-btn').first().click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });

    const nameInput = dialog.getByTestId('court-name-input').locator('input');
    await nameInput.clear();
    await nameInput.fill('Updated Court 1');
    await dialog.getByTestId('save-court-btn').click();

    await expect(page.getByText('Updated Court 1')).toBeVisible({ timeout: 10000 });
  });

  test('should delete court', async ({ page }) => {
    await page.reload();
    await page.waitForSelector('text=Courts', { timeout: 10000 });

    // The component uses native confirm() — register handler before triggering delete
    page.on('dialog', dialog => dialog.accept());

    const courtCard = page.locator('.v-card', { hasText: 'New Test Court' }).first();
    await courtCard.getByTestId('delete-court-btn').first().click();

    await expect(page.getByText('New Test Court')).not.toBeVisible({ timeout: 10000 });
  });

  test('should change court status to maintenance', async ({ page }) => {
    const courtCard = page.locator('.v-card', { hasText: 'Court 1' }).first();
    await courtCard.getByText(/Set Maintenance|Set Available/).first().click();

    await expect(page.getByText(/maintenance/i).first()).toBeVisible();
  });
});
