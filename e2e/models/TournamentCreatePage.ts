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
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
    const formatLabel = format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination';
    await this.page.getByLabel(formatLabel).click();
  }

  async selectCategories(categoryNames: string[]) {
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
    for (const name of categoryNames) {
      const checkbox = this.page.getByRole('checkbox', { name, exact: true });
      await expect(checkbox).toBeVisible();
      await checkbox.click();
    }
  }

  async configureCourts(courtCount: number) {
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
    const addButton = this.page.getByRole('button', { name: 'Add Court' });
    for (let i = 1; i < courtCount; i++) {
      await addButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  async submit() {
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
    await this.createButton.click();
    await this.page.waitForURL(/\/tournaments\/.+/, { timeout: 10000 });
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
