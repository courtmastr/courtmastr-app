import { Page, Locator, expect } from '@playwright/test';

export class TournamentCreatePage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly locationInput: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly continueButton: Locator;
  readonly backButton: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel('Tournament Name');
    this.descriptionInput = page.getByLabel('Description');
    this.locationInput = page.getByLabel('Location');
    this.startDateInput = page.getByLabel('Start Date');
    this.endDateInput = page.getByLabel('End Date');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.backButton = page.getByRole('button', { name: 'Back' });
    this.createButton = page.getByRole('button', { name: 'Create Tournament' });
  }

  private async clickContinueIfEnabled(): Promise<void> {
    const isVisible = await this.continueButton.isVisible().catch(() => false);
    const isEnabled = await this.continueButton.isEnabled().catch(() => false);
    if (isVisible && isEnabled) {
      await this.continueButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async goto() {
    await this.page.goto('/tournaments/create');
    await expect(this.nameInput).toBeVisible();
  }

  async fillBasicInfo(name: string, description: string, location: string, startDate: string, endDate: string) {
    await this.nameInput.fill(name);
    await this.descriptionInput.fill(description);
    await this.locationInput.fill(location);
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
  }

  async selectFormat(format: 'single_elimination' | 'double_elimination') {
    // New flow: tournament-level format is implicit; categories carry format config.
    // Keep compatibility with older flows by advancing to the categories step.
    await this.clickContinueIfEnabled();

    const formatLabel = format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination';
    const legacyFormatField = this.page.getByLabel(formatLabel);
    if (await legacyFormatField.isVisible().catch(() => false)) {
      await legacyFormatField.click();
    }
  }

  async selectCategories(categoryNames: string[]) {
    // Ensure we are on the category step.
    const firstCategory = this.page.getByRole('checkbox', { name: categoryNames[0], exact: true });
    if (!await firstCategory.isVisible().catch(() => false)) {
      await this.clickContinueIfEnabled();
    }

    for (const name of categoryNames) {
      const checkbox = this.page.getByRole('checkbox', { name, exact: true });
      await expect(checkbox).toBeVisible();
      await checkbox.click();
    }
  }

  async configureCourts(courtCount: number) {
    const addButton = this.page.getByRole('button', { name: 'Add Court' });

    // Ensure we are on the courts step.
    if (!await addButton.isVisible().catch(() => false)) {
      await this.clickContinueIfEnabled();
    }
    await expect(addButton).toBeVisible();

    for (let i = 1; i < courtCount; i++) {
      await addButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  async submit() {
    // Move from courts to settings if needed.
    if (!await this.createButton.isVisible().catch(() => false)) {
      await this.clickContinueIfEnabled();
    }
    await expect(this.createButton).toBeVisible();

    await this.createButton.click();
    await this.page.waitForURL(
      (url) => /^\/tournaments\/[^/]+$/.test(url.pathname),
      { timeout: 10000 }
    );
  }

  async createFullTournament(
    name: string,
    description: string,
    location: string,
    startDate: string,
    endDate: string,
    format: 'single_elimination' | 'double_elimination',
    categories: string[],
    courtCount: number
  ) {
    await this.fillBasicInfo(name, description, location, startDate, endDate);
    await this.selectFormat(format);
    await this.selectCategories(categories);
    await this.configureCourts(courtCount);
    await this.submit();
  }
}
