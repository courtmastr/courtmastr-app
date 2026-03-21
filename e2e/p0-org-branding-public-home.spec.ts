import path from 'node:path';
import { test, expect } from './fixtures/auth-fixtures';
import {
  getLifecycleSnapshot,
  seedCompletedLifecycleScenario,
} from './utils/lifecycle-scenarios';

const logoAssetPath = path.resolve(process.cwd(), 'e2e/fixtures/assets/org-logo.svg');
const bannerAssetPath = path.resolve(process.cwd(), 'e2e/fixtures/assets/org-banner.svg');
const sponsorAssetPath = path.resolve(process.cwd(), 'e2e/fixtures/assets/sponsor-logo.svg');

test.describe('P0 - Org Branding Public Home', () => {
  test('updates organization branding in admin and shows it on the public org page', async ({ page }) => {
    const scenario = await seedCompletedLifecycleScenario();
    const updatedOrgName = 'CourtMastr Lifecycle Club Elite';
    const updatedAbout = 'CourtMastr lifecycle coverage org for branding, pool-to-elimination completion, and public result verification.';
    const sponsorName = 'Summit Shuttle';

    await page.goto('/org/profile');
    await expect(page.getByText(scenario.orgName)).toBeVisible({ timeout: 30000 });

    const activeFileInputs = page.locator('.v-window-item--active input[type="file"]');
    await activeFileInputs.nth(0).setInputFiles(logoAssetPath);
    await page.getByRole('button', { name: 'Save Logo' }).click();
    await expect(page.getByText('Logo updated')).toBeVisible({ timeout: 30000 });

    await activeFileInputs.nth(1).setInputFiles(bannerAssetPath);
    await page.getByRole('button', { name: 'Save Banner' }).click();
    await expect(page.getByText('Banner updated')).toBeVisible({ timeout: 30000 });

    await page.getByLabel('Organization Name').fill(updatedOrgName);
    await page.getByLabel('Contact Email').fill('hello@courtmastr-lifecycle.local');
    await page.getByLabel('Website URL').fill('https://courtmastr.local/lifecycle-club');
    await page.getByLabel('About / Description').fill(updatedAbout);
    await page.getByLabel('City / Location').fill('Chicago, IL');
    await page.getByRole('button', { name: 'Save Profile' }).first().click();
    await expect(page.getByText('Organization profile saved')).toBeVisible({ timeout: 30000 });

    await page.getByRole('tab', { name: 'Sponsors' }).click();
    await page.getByLabel('Sponsor Name *').fill(sponsorName);
    await page.getByLabel('Website (optional)').fill('https://summitshuttle.local');
    await page.locator('.v-window-item--active input[type="file"]').first().setInputFiles(sponsorAssetPath);
    await page.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.getByText('Sponsor added')).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const snapshot = await getLifecycleSnapshot();
      return {
        logo: Boolean(snapshot.orgLogoUrl),
        banner: Boolean(snapshot.orgBannerUrl),
        sponsors: snapshot.sponsorCount,
        orgName: snapshot.orgName,
      };
    }, { timeout: 30000 }).toEqual({
      logo: true,
      banner: true,
      sponsors: 1,
      orgName: updatedOrgName,
    });

    await page.goto(`/${scenario.orgSlug}`);
    await expect(page.getByRole('heading', { name: updatedOrgName })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(updatedAbout)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(scenario.tournamentName)).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.org-hero__logo-img')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.org-sponsor-carousel__logo').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator(`.org-sponsor-carousel__logo[alt="${sponsorName}"]`).first()).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      return page.locator('.org-hero__banner').evaluate((element) => {
        return window.getComputedStyle(element).backgroundImage;
      });
    }, { timeout: 30000 }).not.toBe('none');
  });
});
