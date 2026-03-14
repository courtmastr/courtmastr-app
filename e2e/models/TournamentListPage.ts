import { Page, Locator, expect } from '@playwright/test';

export class TournamentListPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly tournamentCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /create tournament/i });
    this.tournamentCards = page.locator('[class*="tournament-card"]').or(page.locator('.v-card'));
  }

  async goto() {
    await this.page.goto('/tournaments');
    await expect(this.page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
  }

  async clickCreateTournament() {
    await this.createButton.click();
    await this.page.waitForURL('/tournaments/create');
  }

  async findTournamentByName(name: string): Promise<Locator | null> {
    const card = this.page.locator('.v-card', { hasText: name });
    if (await card.count() > 0) {
      return card.first();
    }
    return null;
  }

  async openTournament(name: string) {
    const card = await this.findTournamentByName(name);
    if (card) {
      await card.click();
    } else {
      throw new Error(`Tournament "${name}" not found`);
    }
  }
}
