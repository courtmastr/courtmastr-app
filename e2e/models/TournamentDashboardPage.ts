import { Page, Locator, expect } from '@playwright/test';

export class TournamentDashboardPage {
  readonly page: Page;
  readonly manageRegistrationsButton: Locator;
  readonly matchControlButton: Locator;
  readonly generateBracketsButton: Locator;
  readonly publishButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // v-btn :to="..." renders as <a> (link role), not a button
    this.manageRegistrationsButton = page.getByRole('link', { name: /manage registrations/i });
    // "View Match Control" button uses @click so it stays a button
    this.matchControlButton = page.getByRole('button', { name: /match control/i });
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
    await this.matchControlButton.click();
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
    await expect(this.page.getByRole('heading')).toContainText(name);
  }
}
