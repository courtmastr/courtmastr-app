import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

test.describe('Browser compatibility and cache recovery', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test('recovery page clears browser-owned cache state and returns to login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('cm_a2hs_v1', '1');
      window.sessionStorage.setItem('cm_temp_recovery', '1');
    });

    await page.goto('/recover.html?returnTo=%2Flogin');
    await page.waitForURL(/\/login\?/);

    const storageState = await page.evaluate(() => ({
      addToHomeDismissed: window.localStorage.getItem('cm_a2hs_v1'),
      tempRecovery: window.sessionStorage.getItem('cm_temp_recovery'),
    }));

    await expect(page).toHaveURL(/cacheRecovered=1/);
    expect(storageState).toEqual({
      addToHomeDismissed: null,
      tempRecovery: null,
    });
  });

  test('public schedule stays within the viewport in reduced-motion mode', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/tournaments/${tournamentId}/schedule`);
    await expect(page.getByText(/Live Tournament Schedule|Tournament not found/i)).toBeVisible();

    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - window.innerWidth,
      root: document.documentElement.scrollWidth - window.innerWidth,
    }));

    expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
  });
});
