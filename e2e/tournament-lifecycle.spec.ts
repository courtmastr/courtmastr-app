import { test, expect, Page } from '@playwright/test';
import {
  TournamentListPage,
  TournamentCreatePage,
  TournamentDashboardPage,
  RegistrationManagementPage,
  MatchControlPage,
  PublicBracketPage,
  PublicLiveScoresPage,
} from './models/index';

test.describe.configure({ mode: 'serial' });

test.describe.skip('Tournament Lifecycle', () => {
  let page: Page;
  let context: import('@playwright/test').BrowserContext;
  let tournamentId: string;
  const tournamentName = `E2E Test Tournament ${Date.now()}`;
  const players = [
    { firstName: 'John', lastName: 'Smith', email: 'john@test.com', phone: '555-0101' },
    { firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', phone: '555-0102' },
    { firstName: 'Bob', lastName: 'Johnson', email: 'bob@test.com', phone: '555-0103' },
    { firstName: 'Alice', lastName: 'Williams', email: 'alice@test.com', phone: '555-0104' },
    { firstName: 'Charlie', lastName: 'Brown', email: 'charlie@test.com', phone: '555-0105' },
    { firstName: 'Diana', lastName: 'Prince', email: 'diana@test.com', phone: '555-0106' },
    { firstName: 'Edward', lastName: 'Norton', email: 'edward@test.com', phone: '555-0107' },
    { firstName: 'Fiona', lastName: 'Apple', email: 'fiona@test.com', phone: '555-0108' },
  ];

  test.beforeAll(async ({ browser }) => {
    // Firebase auth state lives in IndexedDB (not captured in Playwright storageState).
    // Create a fresh context and perform a full UI login to get a valid auth session.
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@courtmastr.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test('Step 1: Navigate to tournament list', async () => {
    const listPage = new TournamentListPage(page);
    await listPage.goto();
    await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
  });

  test('Step 2: Create a new tournament', async () => {
    const listPage = new TournamentListPage(page);
    await listPage.clickCreateTournament();

    const createPage = new TournamentCreatePage(page);
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await createPage.createFullTournament(
      tournamentName,
      'E2E Test Tournament Description',
      'Test Location',
      startDate,
      endDate,
      'single_elimination',
      ["Men's Singles"],
      2
    );

    tournamentId = page.url().split('/tournaments/')[1].split('/')[0];
    expect(tournamentId).toMatch(/\S+/);

    const dashboardPage = new TournamentDashboardPage(page);
    await dashboardPage.expectTournamentName(tournamentName);
  });

  test('Step 3: Add players to tournament', async () => {
    const dashboardPage = new TournamentDashboardPage(page);
    await dashboardPage.navigateToRegistrations();

    const registrationPage = new RegistrationManagementPage(page);
    
    for (const player of players) {
      await registrationPage.addPlayer(
        player.firstName,
        player.lastName,
        player.email,
        player.phone
      );
    }
    await expect(registrationPage.addRegistrationButton).toBeVisible();
  });

  test('Step 4: Register players for category', async () => {
    const registrationPage = new RegistrationManagementPage(page);
    
    for (const player of players) {
      await registrationPage.addRegistration(
        `${player.firstName} ${player.lastName}`,
        "Men's Singles"
      );
    }

    await registrationPage.registrationsTab.click();
    for (const player of players) {
      await expect(page.getByText(`${player.firstName} ${player.lastName}`)).toBeVisible();
    }
  });

  test('Step 5: Check in participants', async () => {
    const registrationPage = new RegistrationManagementPage(page);
    
    for (const player of players.slice(0, 4)) {
      await registrationPage.checkInParticipant(`${player.firstName} ${player.lastName}`);
    }

    for (const player of players.slice(0, 4)) {
      await registrationPage.expectParticipantStatus(
        `${player.firstName} ${player.lastName}`,
        'checked_in'
      );
    }
  });

  test('Step 6: Undo check-in for one participant', async () => {
    const registrationPage = new RegistrationManagementPage(page);
    const playerToUndo = players[0];
    
    await registrationPage.undoCheckIn(`${playerToUndo.firstName} ${playerToUndo.lastName}`);
    await registrationPage.expectParticipantStatus(
      `${playerToUndo.firstName} ${playerToUndo.lastName}`,
      'approved'
    );
    
    await registrationPage.checkInParticipant(`${playerToUndo.firstName} ${playerToUndo.lastName}`);
  });

  test('Step 7: Withdraw and reinstate a participant', async () => {
    const registrationPage = new RegistrationManagementPage(page);
    const playerToWithdraw = players[7];
    
    await registrationPage.withdrawParticipant(`${playerToWithdraw.firstName} ${playerToWithdraw.lastName}`);
    await registrationPage.expectParticipantStatus(
      `${playerToWithdraw.firstName} ${playerToWithdraw.lastName}`,
      'withdrawn'
    );
    
    await registrationPage.reinstateParticipant(`${playerToWithdraw.firstName} ${playerToWithdraw.lastName}`);
    await registrationPage.expectParticipantStatus(
      `${playerToWithdraw.firstName} ${playerToWithdraw.lastName}`,
      'approved'
    );
  });

  test('Step 8: Generate brackets', async () => {
    await page.goto(`/tournaments/${tournamentId}`);
    const dashboardPage = new TournamentDashboardPage(page);
    
    await dashboardPage.generateBrackets();
    await page.waitForTimeout(3000);
    
    await expect(page.getByText(/bracket|matches/i)).toBeVisible();
  });

  test('Step 9: Navigate to match control', async () => {
    const dashboardPage = new TournamentDashboardPage(page);
    await dashboardPage.navigateToMatchControl();

    const matchControlPage = new MatchControlPage(page);
    await expect(matchControlPage.matchesTable).toBeVisible();
  });

  test('Step 10: Auto-schedule matches', async () => {
    const matchControlPage = new MatchControlPage(page);
    await matchControlPage.autoSchedule();
    
    await page.waitForTimeout(3000);
    await expect(page.getByText(/scheduled|ready/i).first()).toBeVisible();
  });

  test('Step 11: Assign courts to matches', async () => {
    const matchControlPage = new MatchControlPage(page);
    await matchControlPage.assignCourts();
    
    await page.waitForTimeout(2000);
  });

  test('Step 12: Check public bracket page', async () => {
    const publicBracketPage = new PublicBracketPage(page);
    await publicBracketPage.goto(tournamentId);
    await publicBracketPage.expectBracketVisible();
  });

  test('Step 13: Check public live scores page', async () => {
    const publicLiveScoresPage = new PublicLiveScoresPage(page);
    await publicLiveScoresPage.goto(tournamentId);
    await expect(page.getByText(/live|scores|matches/i).first()).toBeVisible();
  });

  test('Step 14: Enter match scores manually', async () => {
    await page.goto(`/tournaments/${tournamentId}/match-control`);
    const matchControlPage = new MatchControlPage(page);
    
    await matchControlPage.enterScore(1, 21, 15);
    await matchControlPage.expectMatchStatus(1, /completed|finished/i);
  });

  test('Step 15: Complete tournament', async () => {
    await page.goto(`/tournaments/${tournamentId}`);
    
    const completeButton = page.getByRole('button', { name: /complete|finish|end tournament/i });
    await expect(completeButton).toBeVisible();
    await completeButton.click();
    await page.waitForTimeout(2000);
    
    await expect(page.getByText(/completed|finished|closed/i).first()).toBeVisible();
  });

  test('Step 16: Verify notifications are working', async () => {
    const notificationButton = page.locator('button').filter({ has: page.locator('.v-badge') }).first();
    await expect(notificationButton).toBeVisible();
    await notificationButton.click();
    await expect(page.locator('.v-menu').or(page.locator('.v-list'))).toBeVisible();
  });

  test('Step 17: Verify activity feed', async () => {
    const activityTab = page.getByRole('tab', { name: /activity/i });
    await expect(activityTab).toBeVisible();
    await activityTab.click();
    await expect(page.getByText(/activity|history|log/i).first()).toBeVisible();
  });
});
