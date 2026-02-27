import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.describe('P0 - Self Check-in Kiosk', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('renders self-check-in search form', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/self-checkin`);
    await expect(page.getByText('Self Check-In')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Type player name' })).toBeVisible();
  });

  test('shows no-match feedback for unmatched participant query', async ({ page }) => {
    await page.goto(`/tournaments/${tournamentId}/self-checkin`);
    const input = page.getByRole('textbox', { name: 'Type player name' });
    await input.fill('zzzzzz');
    await page.waitForTimeout(300);
    await expect(page.getByText('No matching participants found.')).toBeVisible();
  });
});
