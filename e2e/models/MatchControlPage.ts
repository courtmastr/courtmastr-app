import { Page, Locator, expect } from '@playwright/test';

export class MatchControlPage {
  readonly page: Page;
  readonly autoScheduleButton: Locator;
  readonly assignCourtsButton: Locator;
  readonly matchesTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.autoScheduleButton = page.getByRole('button', { name: /auto schedule/i });
    this.assignCourtsButton = page.getByRole('button', { name: /assign courts/i });
    this.matchesTable = page.locator('.v-data-table').or(page.locator('table'));
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/match-control`);
    await expect(this.matchesTable).toBeVisible();
  }

  async autoSchedule() {
    await this.autoScheduleButton.click();
    await this.page.waitForTimeout(3000);
  }

  async assignCourts() {
    await this.assignCourtsButton.click();
    await this.page.waitForTimeout(2000);
  }

  async startMatch(matchNumber: number) {
    const matchRow = this.page.locator('tr', { hasText: `Match ${matchNumber}` });
    const startButton = matchRow.getByRole('button', { name: /start/i });
    await expect(startButton).toBeVisible();
    await startButton.click();
    await this.page.waitForTimeout(1000);
  }

  async enterScore(matchNumber: number, player1Score: number, player2Score: number) {
    const matchRow = this.page.locator('tr', { hasText: `Match ${matchNumber}` });
    const scoreButton = matchRow.getByRole('button', { name: /enter score/i }).or(matchRow.getByRole('button', { name: /score/i }));
    
    await scoreButton.click();
    await this.page.waitForTimeout(500);
    
    const dialog = this.page.locator('.v-dialog');
    const score1Input = dialog.locator('input').first();
    const score2Input = dialog.locator('input').nth(1);
    
    await score1Input.fill(player1Score.toString());
    await score2Input.fill(player2Score.toString());
    
    await dialog.getByRole('button', { name: /save|submit/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async expectMatchStatus(matchNumber: number, status: string | RegExp) {
    const matchRow = this.page.locator('tr', { hasText: `Match ${matchNumber}` });
    const statusChip = matchRow.locator('.v-chip');
    await expect(statusChip).toContainText(status);
  }
}
