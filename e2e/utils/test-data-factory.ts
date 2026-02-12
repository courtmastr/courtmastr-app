import type { Page } from '@playwright/test';

export interface TestTournament {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
}

export interface TestCategory {
  id: string;
  name: string;
  type: 'singles' | 'doubles' | 'mixed_doubles';
  gender: 'men' | 'women' | 'mixed' | 'open';
  seedingEnabled?: boolean;
  maxParticipants?: number;
}

export interface TestCourt {
  id: string;
  name: string;
  number: number;
  status: 'available' | 'in_use' | 'maintenance';
}

export interface TestPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export class TestDataFactory {
  private page: Page;
  private tournaments: Map<string, TestTournament> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  async loginAsAdmin(): Promise<void> {
    await this.page.goto('/tournaments');

    if (this.page.url().includes('/login')) {
      await this.page.locator('input[type="email"]').fill('admin@courtmaster.local');
      await this.page.locator('input[type="password"]').fill('admin123');
      await this.page.getByRole('button', { name: 'Sign In' }).click();
      await this.page.waitForURL('/tournaments', { timeout: 10000 });
    }
  }

  async createTournament(overrides: Partial<TestTournament> = {}): Promise<TestTournament> {
    const timestamp = Date.now();
    const tournament: TestTournament = {
      id: '',
      name: `E2E Test Tournament ${timestamp}`,
      description: 'Test tournament for E2E testing',
      location: 'Test Location',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ...overrides,
    };

    await this.page.goto('/tournaments/create');
    await this.page.waitForLoadState('networkidle');
    
    const nameInput = this.page.locator('input[data-testid="tournament-name"]').or(this.page.getByTestId('tournament-name'));
    await nameInput.waitFor({ state: 'visible', timeout: 15000 });
    await nameInput.fill(tournament.name);
    
    const descInput = this.page.locator('textarea[data-testid="tournament-description"]').or(this.page.getByTestId('tournament-description'));
    await descInput.fill(tournament.description);
    
    const locInput = this.page.locator('input[data-testid="tournament-location"]').or(this.page.getByTestId('tournament-location'));
    await locInput.fill(tournament.location);
    
    const startInput = this.page.locator('input[data-testid="tournament-start-date"]').or(this.page.getByTestId('tournament-start-date'));
    await startInput.fill(tournament.startDate);
    
    const endInput = this.page.locator('input[data-testid="tournament-end-date"]').or(this.page.getByTestId('tournament-end-date'));
    await endInput.fill(tournament.endDate);

    await this.page.getByRole('button', { name: /continue/i }).click();
    await this.page.waitForTimeout(1000);

    await this.page.getByLabel('Single Elimination').click();
    await this.page.getByRole('button', { name: /continue/i }).click();
    await this.page.waitForTimeout(1000);

    await this.page.getByLabel("Men's Singles").click();
    await this.page.getByLabel("Women's Singles").click();
    await this.page.getByRole('button', { name: /continue/i }).click();
    await this.page.waitForTimeout(1000);

    await this.page.getByRole('button', { name: /continue/i }).click();
    await this.page.waitForTimeout(1000);

    await this.page.getByRole('button', { name: /create tournament/i }).click();
    await this.page.waitForURL(/\/tournaments\/.+/, { timeout: 15000 });

    tournament.id = this.page.url().split('/tournaments/')[1].split('/')[0];
    this.tournaments.set(tournament.id, tournament);

    return tournament;
  }

  async addCategory(tournamentId: string, category: Omit<TestCategory, 'id'>): Promise<TestCategory> {
    await this.page.goto(`/tournaments/${tournamentId}`);
    await this.page.getByRole('tab', { name: /categories/i }).click();
    await this.page.getByRole('button', { name: /add category/i }).click();

    await this.page.getByLabel('Category Name').fill(category.name);
    
    await this.page.getByLabel('Type').click();
    await this.page.getByRole('option', { name: new RegExp(category.type, 'i') }).click();

    await this.page.getByLabel('Gender').click();
    await this.page.getByRole('option', { name: new RegExp(category.gender, 'i') }).click();

    if (category.seedingEnabled) {
      await this.page.getByLabel('Enable Seeding').click();
    }

    if (category.maxParticipants) {
      await this.page.getByLabel('Max Participants').fill(category.maxParticipants.toString());
    }

    await this.page.getByRole('button', { name: /save|add/i }).click();
    await this.page.waitForTimeout(500);

    return {
      id: `cat-${Date.now()}`,
      ...category,
    };
  }

  async addCourt(tournamentId: string, court: Omit<TestCourt, 'id'>): Promise<TestCourt> {
    await this.page.goto(`/tournaments/${tournamentId}`);
    await this.page.getByRole('tab', { name: /courts/i }).click();
    await this.page.getByRole('button', { name: /add court/i }).click();

    await this.page.getByLabel('Court Name').fill(court.name);
    await this.page.getByLabel('Court Number').fill(court.number.toString());

    await this.page.getByRole('button', { name: /save|add/i }).click();
    await this.page.waitForTimeout(500);

    return {
      id: `court-${Date.now()}`,
      ...court,
    };
  }

  async addPlayer(tournamentId: string, player: Omit<TestPlayer, 'id'>): Promise<TestPlayer> {
    await this.page.goto(`/tournaments/${tournamentId}/registrations`);
    await this.page.getByRole('button', { name: /add player/i }).click();

    const dialog = this.page.locator('.v-dialog');
    await dialog.getByLabel('First Name').fill(player.firstName);
    await dialog.getByLabel('Last Name').fill(player.lastName);
    await dialog.getByLabel('Email').fill(player.email);
    await dialog.getByLabel('Phone').fill(player.phone);

    await dialog.getByRole('button', { name: 'Add Player' }).click();
    await this.page.waitForTimeout(500);

    return {
      id: `player-${Date.now()}`,
      ...player,
    };
  }

  async cleanup(): Promise<void> {
    for (const [id, tournament] of this.tournaments) {
      try {
        await this.page.goto(`/tournaments/${id}`);
        await this.page.getByRole('button', { name: /settings/i }).click();
        await this.page.getByRole('button', { name: /delete tournament/i }).click();
        await this.page.getByRole('button', { name: /confirm|yes|delete/i }).click();
        await this.page.waitForURL('/tournaments', { timeout: 10000 });
      } catch (e) {
        console.log(`Failed to cleanup tournament ${tournament.name}:`, e);
      }
    }
    this.tournaments.clear();
  }
}

export async function createTestDataFactory(page: Page): Promise<TestDataFactory> {
  return new TestDataFactory(page);
}
