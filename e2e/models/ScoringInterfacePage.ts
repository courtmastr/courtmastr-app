import { Page, Locator, expect } from '@playwright/test';

export class ScoringInterfacePage {
  readonly page: Page;
  readonly player1Score: Locator;
  readonly player2Score: Locator;
  readonly incrementP1Button: Locator;
  readonly incrementP2Button: Locator;
  readonly decrementP1Button: Locator;
  readonly decrementP2Button: Locator;
  readonly submitScoreButton: Locator;
  readonly completeMatchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.player1Score = page.locator('[data-testid="player1-score"]').or(page.locator('.score-player1'));
    this.player2Score = page.locator('[data-testid="player2-score"]').or(page.locator('.score-player2'));
    this.incrementP1Button = page.getByRole('button', { name: /\+1.*player 1/i }).or(page.locator('button').nth(0));
    this.incrementP2Button = page.getByRole('button', { name: /\+1.*player 2/i }).or(page.locator('button').nth(2));
    this.decrementP1Button = page.getByRole('button', { name: /-1.*player 1/i });
    this.decrementP2Button = page.getByRole('button', { name: /-1.*player 2/i });
    this.submitScoreButton = page.getByRole('button', { name: /submit|save/i });
    this.completeMatchButton = page.getByRole('button', { name: /complete match|finish/i });
  }

  async goto(tournamentId: string, matchId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/matches/${matchId}/score`);
    await expect(this.player1Score.or(this.incrementP1Button)).toBeVisible();
  }

  async incrementPlayer1Score(times: number = 1) {
    for (let i = 0; i < times; i++) {
      await this.incrementP1Button.click();
      await this.page.waitForTimeout(100);
    }
  }

  async incrementPlayer2Score(times: number = 1) {
    for (let i = 0; i < times; i++) {
      await this.incrementP2Button.click();
      await this.page.waitForTimeout(100);
    }
  }

  async setScore(player1Points: number, player2Points: number) {
    await this.incrementPlayer1Score(player1Points);
    await this.incrementPlayer2Score(player2Points);
  }

  async submitGame() {
    await this.submitScoreButton.click();
    await this.page.waitForTimeout(1000);
  }

  async completeMatch() {
    await this.completeMatchButton.click();
    await this.page.waitForTimeout(2000);
  }

  async expectScore(player1Points: number, player2Points: number) {
    const p1Text = await this.player1Score.textContent();
    const p2Text = await this.player2Score.textContent();
    expect(p1Text).toContain(player1Points.toString());
    expect(p2Text).toContain(player2Points.toString());
  }
}
