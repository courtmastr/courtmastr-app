import { test, expect, getTournamentId } from './fixtures/auth-fixtures';
import { join } from 'path';

test.describe('P0 - Branding Logos', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('uploads sponsor and tournament logos, then renders them on public views', async ({ page }) => {
    const tournamentLogoPath = join(process.cwd(), 'public', 'pwa-192x192.png');
    const sponsorLogoPath = join(process.cwd(), 'public', 'favicon-32x32.png');
    const sponsorName = `E2E Sponsor ${Date.now()}`;
    const sponsorWebsite = `https://example.com/${Date.now()}`;

    await page.goto(`/tournaments/${tournamentId}/settings`);
    await expect(page.getByRole('heading', { name: /tournament settings/i })).toBeVisible();

    await page.getByTestId('add-sponsor').click();

    const sponsorRow = page.locator('.sponsor-row').first();
    await sponsorRow.locator('input[type="text"]').first().fill(sponsorName);
    await sponsorRow.locator('input[type="text"]').nth(1).fill(sponsorWebsite);

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(tournamentLogoPath);
    await fileInputs.nth(1).setInputFiles(sponsorLogoPath);

    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/settings saved successfully!/i)).toBeVisible({ timeout: 15000 });

    await page.goto(`/tournaments/${tournamentId}/schedule`);
    await expect(page.locator(`a[href="${sponsorWebsite}"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`img[alt="${sponsorName} logo"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.schedule-header .tournament-brand-mark img').first()).toBeVisible({ timeout: 15000 });

    await page.goto(`/overlay/${tournamentId}/board`);
    await expect(page.locator(`img[alt="${sponsorName} logo"]`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.board-header .tournament-brand-mark img').first()).toBeVisible({ timeout: 15000 });
  });
});
