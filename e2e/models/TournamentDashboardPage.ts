import { Page, Locator, expect } from '@playwright/test';

export class TournamentDashboardPage {
  readonly page: Page;
  readonly manageRegistrationsButton: Locator;
  readonly matchControlButton: Locator;
  readonly generateBracketsButton: Locator;
  readonly publishButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Depending on tournament state, dashboard may show "Review Registrations" CTA or only sidebar "Registrations".
    this.manageRegistrationsButton = page.getByRole('link', { name: /review registrations|registrations/i }).first();
    // Depending on state/layout this is link CTA or nav link.
    this.matchControlButton = page.getByRole('link', { name: /enter match control|match control/i }).first();
    // CategoryRegistrationStats emits "Generate Bracket" (singular)
    this.generateBracketsButton = page.getByRole('button', { name: /generate bracket/i });
    this.publishButton = page.getByRole('button', { name: /publish/i });
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}`);
    await expect(this.page.getByRole('heading')).toBeVisible();
  }

  async navigateToRegistrations() {
    await this.manageRegistrationsButton.click();
    await this.page.waitForURL(/\/tournaments\/.+\/registrations/);
  }

  async navigateToMatchControl() {
    if (await this.matchControlButton.isVisible().catch(() => false)) {
      await this.matchControlButton.click();
    } else {
      await this.page.getByRole('button', { name: /match control/i }).click();
    }
    await this.page.waitForURL(/\/tournaments\/.+\/match-control/);
  }

  async generateBrackets() {
    await this.generateBracketsButton.click();
    await this.page.waitForTimeout(2000);
  }

  async publishTournament() {
    await this.publishButton.click();
    await this.page.waitForTimeout(1000);
  }

  async expectTournamentName(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }
}
