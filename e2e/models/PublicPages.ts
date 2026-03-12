import { Page, Locator, expect } from '@playwright/test';

export class PublicBracketPage {
  readonly page: Page;
  readonly bracketContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bracketContainer = page.locator('.brackets-viewer').or(page.locator('.bracket-viewer')).or(page.locator('.bracket-container'));
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/bracket`);
    await expect(this.bracketContainer).toBeVisible();
  }

  async expectBracketVisible() {
    await expect(this.bracketContainer).toBeVisible();
  }

  async expectMatchVisible(player1Name: string, player2Name: string) {
    const matchElement = this.page.locator('.match', { hasText: player1Name }).or(
      this.page.locator('.match', { hasText: player2Name })
    );
    await expect(matchElement).toBeVisible();
  }
}

export class PublicLiveScoresPage {
  readonly page: Page;
  readonly scoresContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scoresContainer = page.locator('.schedule-grid').or(page.locator('.display-mode')).or(page.locator('.scores-container'));
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/schedule`);
    await expect(
      this.scoresContainer.or(this.page.getByText(/published player schedule|tournament not found/i).first())
    ).toBeVisible();
  }

  async expectScoreVisible(playerName: string) {
    const scoreElement = this.page.locator('.score-item', { hasText: playerName });
    await expect(scoreElement).toBeVisible();
  }
}

export class PublicScoringPage {
  readonly page: Page;
  readonly scoringContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scoringContainer = page.locator('.scoring-interface').or(page.locator('.public-scoring'));
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/score`);
    await expect(this.scoringContainer).toBeVisible();
  }
}
