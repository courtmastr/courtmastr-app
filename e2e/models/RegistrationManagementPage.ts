import { Page, Locator, expect } from '@playwright/test';

export class RegistrationManagementPage {
  readonly page: Page;
  readonly addPlayerButton: Locator;
  readonly addRegistrationButton: Locator;
  readonly importCsvButton: Locator;
  readonly checkInTab: Locator;
  readonly playersTab: Locator;
  readonly registrationsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addPlayerButton = page.getByRole('button', { name: /add player/i });
    this.addRegistrationButton = page.getByRole('button', { name: /add registration/i });
    this.importCsvButton = page.getByRole('button', { name: /import csv/i });
    this.checkInTab = page.getByRole('tab', { name: /check-in/i });
    this.playersTab = page.getByRole('tab', { name: /players/i });
    this.registrationsTab = page.getByRole('tab', { name: /registrations/i });
  }

  async goto(tournamentId: string) {
    await this.page.goto(`/tournaments/${tournamentId}/registrations`);
    await expect(this.addPlayerButton).toBeVisible();
  }

  async addPlayer(firstName: string, lastName: string, email: string, phone: string, skillLevel: number = 5) {
    await this.addPlayerButton.click();
    
    const dialog = this.page.locator('.v-dialog');
    await expect(dialog).toBeVisible();
    
    await dialog.getByLabel('First Name').fill(firstName);
    await dialog.getByLabel('Last Name').fill(lastName);
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Phone').fill(phone);
    
    const slider = dialog.locator('.v-slider');
    if (await slider.isVisible()) {
      await slider.click();
    }
    
    await dialog.getByRole('button', { name: 'Add Player' }).click();
    await this.page.waitForTimeout(1000);
  }

  async addRegistration(playerName: string, categoryName: string, partnerName?: string) {
    await this.addRegistrationButton.click();
    
    const dialog = this.page.locator('.v-dialog');
    await expect(dialog).toBeVisible();
    
    await dialog.getByLabel('Category').click();
    await this.page.getByRole('option', { name: categoryName }).click();
    
    await dialog.getByLabel('Player').click();
    await this.page.getByRole('option', { name: playerName }).click();
    
    if (partnerName) {
      await dialog.getByLabel('Partner').click();
      await this.page.getByRole('option', { name: partnerName }).click();
    }
    
    await dialog.getByRole('button', { name: 'Add Registration' }).click();
    await this.page.waitForTimeout(1000);
  }

  async checkInParticipant(participantName: string) {
    await this.checkInTab.click();
    await this.page.waitForTimeout(500);
    
    const participantRow = this.page.locator('.v-list-item', { hasText: participantName });
    const checkInButton = participantRow.getByRole('button', { name: /check in/i });
    await expect(checkInButton).toBeVisible();
    await checkInButton.click();
    await this.page.waitForTimeout(500);
  }

  async undoCheckIn(participantName: string) {
    await this.checkInTab.click();
    await this.page.waitForTimeout(500);
    
    const participantRow = this.page.locator('.v-list-item', { hasText: participantName });
    const undoButton = participantRow.getByRole('button', { name: /undo check-in/i });
    await expect(undoButton).toBeVisible();
    await undoButton.click();
    await this.page.waitForTimeout(500);
  }

  async withdrawParticipant(participantName: string) {
    await this.registrationsTab.click();
    await this.page.waitForTimeout(500);
    
    const row = this.page.locator('tr', { hasText: participantName });
    const withdrawButton = row.locator('button[title="Withdraw"]').or(row.getByRole('button', { name: /withdraw/i }));
    await expect(withdrawButton).toBeVisible();
    await withdrawButton.click();
    await this.page.waitForTimeout(500);
  }

  async reinstateParticipant(participantName: string) {
    await this.registrationsTab.click();
    await this.page.waitForTimeout(500);
    
    const row = this.page.locator('tr', { hasText: participantName });
    const reinstateButton = row.locator('button[title="Reinstate"]').or(row.getByRole('button', { name: /reinstate/i }));
    await expect(reinstateButton).toBeVisible();
    await reinstateButton.click();
    await this.page.waitForTimeout(500);
  }

  async expectParticipantStatus(participantName: string, status: 'approved' | 'checked_in' | 'withdrawn') {
    await this.registrationsTab.click();
    await this.page.waitForTimeout(500);
    
    const row = this.page.locator('tr', { hasText: participantName });
    const statusChip = row.locator('.v-chip');
    
    await expect(statusChip).toContainText(status);
  }
}
