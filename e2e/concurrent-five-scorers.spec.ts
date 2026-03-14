import { test, expect, devices, type BrowserContext, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import { createOrSignIn } from '../scripts/seed/helpers';

interface SeedClients {
  auth: Auth;
  db: Firestore;
  adminId: string;
}

interface ScorerAccount {
  email: string;
  password: string;
}

interface SeededMatch {
  matchId: string;
  courtId: string;
  participant1Name: string;
  participant2Name: string;
  participant1RegistrationId: string;
}

interface SeededScenario {
  tournamentId: string;
  categoryId: string;
  scorers: ScorerAccount[];
  matches: SeededMatch[];
}

let seedClients: SeedClients | null = null;
let emulatorConnectionsReady = false;

test.describe.configure({ mode: 'serial' });

async function getSeedClients(): Promise<SeedClients> {
  if (seedClients) return seedClients;

  const existingApp = getApps().find((app) => app.name === 'e2e-concurrent-scorers-seed');
  const app = existingApp
    ?? initializeApp(
      {
        apiKey: 'demo-api-key',
        authDomain: 'demo-courtmaster.firebaseapp.com',
        projectId: 'demo-courtmaster',
      },
      'e2e-concurrent-scorers-seed',
    );

  const auth = getAuth(app);
  const db = getFirestore(app);

  if (!emulatorConnectionsReady) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    emulatorConnectionsReady = true;
  }

  const adminId = await createOrSignIn(auth, db, {
    email: 'admin@courtmastr.com',
    password: 'admin123',
    displayName: 'Tournament Admin',
    role: 'admin',
  });
  await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

  seedClients = { auth, db, adminId };
  return seedClients;
}

async function seedFiveCourtFiveMatchScenario(): Promise<SeededScenario> {
  const { auth, db, adminId } = await getSeedClients();
  const now = Date.now();

  const scorers: ScorerAccount[] = Array.from({ length: 5 }, (_value, index) => ({
    email: `scorekeeper${index + 1}@courtmastr.com`,
    password: 'score123',
  }));

  for (let index = 0; index < scorers.length; index += 1) {
    const scorer = scorers[index];
    await createOrSignIn(auth, db, {
      email: scorer.email,
      password: scorer.password,
      displayName: `Scorekeeper ${index + 1}`,
      role: 'scorekeeper',
    });
  }

  await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

  const tournamentRef = doc(collection(db, 'tournaments'));
  const tournamentId = tournamentRef.id;
  const categoryRef = doc(collection(db, `tournaments/${tournamentId}/categories`));
  const categoryId = categoryRef.id;

  const matches: SeededMatch[] = [];
  const batch = writeBatch(db);

  batch.set(tournamentRef, {
    name: `Concurrent 5x5 Scoring ${now}`,
    description: 'E2E scenario: 5 courts, 5 matches, 5 concurrent scorers',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'active',
    state: 'LIVE',
    startDate: serverTimestamp(),
    endDate: serverTimestamp(),
    settings: {
      minRestTimeMinutes: 0,
      matchDurationMinutes: 20,
      allowSelfRegistration: true,
      requireApproval: true,
      gamesPerMatch: 1,
      pointsToWin: 3,
      mustWinBy: 1,
      maxPoints: 5,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId,
    name: 'Concurrent Singles',
    type: 'singles',
    gender: 'open',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'active',
    seedingEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (let courtIndex = 1; courtIndex <= 5; courtIndex += 1) {
    const courtId = `court-${courtIndex}`;
    const courtRef = doc(db, `tournaments/${tournamentId}/courts/${courtId}`);
    batch.set(courtRef, {
      name: `Court ${courtIndex}`,
      number: courtIndex,
      status: 'available',
      currentMatchId: null,
      assignedMatchId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (let matchIndex = 1; matchIndex <= 5; matchIndex += 1) {
    const participant1Number = (matchIndex - 1) * 2 + 1;
    const participant2Number = participant1Number + 1;

    const player1Id = `player-${participant1Number}`;
    const player2Id = `player-${participant2Number}`;
    const registration1Id = `reg-${participant1Number}`;
    const registration2Id = `reg-${participant2Number}`;
    const participant1DocId = String(participant1Number);
    const participant2DocId = String(participant2Number);

    const participant1Name = `Court${matchIndex} Home`;
    const participant2Name = `Court${matchIndex} Away`;
    const courtId = `court-${matchIndex}`;
    const matchId = `match-${matchIndex}`;

    batch.set(doc(db, `tournaments/${tournamentId}/players/${player1Id}`), {
      firstName: `Court${matchIndex}`,
      lastName: 'Home',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, `tournaments/${tournamentId}/players/${player2Id}`), {
      firstName: `Court${matchIndex}`,
      lastName: 'Away',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/registrations/${registration1Id}`), {
      tournamentId,
      categoryId,
      participantType: 'player',
      playerId: player1Id,
      status: 'checked_in',
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, `tournaments/${tournamentId}/registrations/${registration2Id}`), {
      tournamentId,
      categoryId,
      participantType: 'player',
      playerId: player2Id,
      status: 'checked_in',
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/participant/${participant1DocId}`), {
      id: participant1DocId,
      tournament_id: categoryId,
      name: registration1Id,
    });
    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/participant/${participant2DocId}`), {
      id: participant2DocId,
      tournament_id: categoryId,
      name: registration2Id,
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match/${matchId}`), {
      stage_id: categoryId,
      round: 1,
      bracket: 'winners',
      number: matchIndex,
      status: 2,
      opponent1: { id: participant1DocId },
      opponent2: { id: participant2DocId },
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores/${matchId}`), {
      status: 'ready',
      courtId,
      participant1Id: registration1Id,
      participant2Id: registration2Id,
      plannedStartAt: Timestamp.fromDate(new Date(now + matchIndex * 60_000)),
      plannedEndAt: Timestamp.fromDate(new Date(now + matchIndex * 60_000 + 20 * 60_000)),
      scheduleStatus: 'published',
      publishedAt: serverTimestamp(),
      scores: [
        {
          gameNumber: 1,
          score1: 0,
          score2: 0,
          isComplete: false,
        },
      ],
      updatedAt: serverTimestamp(),
    });

    matches.push({
      matchId,
      courtId,
      participant1Name,
      participant2Name,
      participant1RegistrationId: registration1Id,
    });
  }

  await batch.commit();

  return {
    tournamentId,
    categoryId,
    scorers,
    matches,
  };
}

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid="login-email"] input').fill(email);
  await page.locator('[data-testid="login-password"] input').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 30_000 });
}

async function openScoringPage(page: Page, tournamentId: string, match: SeededMatch): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/score`);
  await expect(page.getByText('Select a match to score')).toBeVisible({ timeout: 30_000 });

  const matchCard = page.locator('.v-card')
    .filter({ hasText: match.participant1Name })
    .filter({ hasText: match.participant2Name })
    .first();

  await expect(matchCard).toBeVisible({ timeout: 30_000 });
  await matchCard.tap();
  await expect(page.getByText('Scoring', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.score-panel').first()).toBeVisible({ timeout: 30_000 });
}

async function addPointsToParticipantOne(page: Page, points: number): Promise<void> {
  const participantOneCard = page.locator('.score-panel').first();
  await expect(participantOneCard).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < points; i += 1) {
    await participantOneCard.tap();
    await page.waitForTimeout(300);
  }
}

async function getParticipantOneScore(page: Page): Promise<number> {
  const scoreText = (await page.locator('.score-panel .score-display').first().textContent())?.trim() || '0';
  return Number(scoreText);
}

async function assertTouchEfficientScoringPanel(page: Page): Promise<void> {
  const panel = page.locator('.score-panel').first();
  await expect(panel).toBeVisible({ timeout: 10_000 });

  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(120);
  expect(bounds!.width).toBeGreaterThanOrEqual(120);

  await expect.poll(async () => {
    const touchAction = await panel.evaluate((element) => getComputedStyle(element).touchAction);
    return touchAction.includes('manipulation');
  }, { timeout: 10_000 }).toBe(true);
}

async function undoParticipantOnePoint(page: Page): Promise<void> {
  const undoButton = page.locator('.score-panel').first().locator('.score-decrement');
  await expect(undoButton).toBeVisible({ timeout: 10_000 });
  await expect(undoButton).toBeEnabled({ timeout: 10_000 });
  await undoButton.tap();
}

async function getOverlayPrimaryScore(page: Page): Promise<number> {
  const scoreText = (await page.locator('.broadcast-point').first().textContent())?.trim() || '0';
  return Number(scoreText);
}

async function getCompletedMatchesCount(db: Firestore, scenario: SeededScenario): Promise<number> {
  const statuses = await Promise.all(
    scenario.matches.map(async (match) => {
      const snap = await getDoc(
        doc(db, `tournaments/${scenario.tournamentId}/categories/${scenario.categoryId}/match_scores/${match.matchId}`),
      );
      return snap.data()?.status as string | undefined;
    }),
  );

  return statuses.filter((status) => status === 'completed').length;
}

async function areFinalScoresUpdated(db: Firestore, scenario: SeededScenario): Promise<boolean> {
  const checks = await Promise.all(
    scenario.matches.map(async (match) => {
      const snap = await getDoc(
        doc(db, `tournaments/${scenario.tournamentId}/categories/${scenario.categoryId}/match_scores/${match.matchId}`),
      );
      if (!snap.exists()) return false;

      const data = snap.data();
      const firstGame = Array.isArray(data.scores) ? data.scores[0] : null;
      return (
        data.status === 'completed'
        && data.winnerId === match.participant1RegistrationId
        && firstGame?.isComplete === true
        && Number(firstGame?.score1) >= 3
        && Number(firstGame?.score2) === 0
      );
    }),
  );

  return checks.every(Boolean);
}

test('handles 5 concurrent mobile scorers across 5 courts with live/public/overlay updates and undo edges', async ({ browser }) => {
  test.setTimeout(240_000);

  const scenario = await seedFiveCourtFiveMatchScenario();
  const { db } = await getSeedClients();

  const contexts: BrowserContext[] = [];
  const overlayPages: Page[] = [];

  try {
    const scheduleContext = await browser.newContext();
    contexts.push(scheduleContext);
    const schedulePage = await scheduleContext.newPage();
    await schedulePage.goto(`/tournaments/${scenario.tournamentId}/schedule`);
    await expect(schedulePage.getByText('Now Playing')).toBeVisible();

    const publicScoreContext = await browser.newContext();
    contexts.push(publicScoreContext);
    const publicScorePage = await publicScoreContext.newPage();
    await publicScorePage.goto(`/tournaments/${scenario.tournamentId}/score`);
    await expect(publicScorePage.getByText('Select a match to score')).toBeVisible();

    const firstMatch = scenario.matches[0];
    const firstMatchCard = publicScorePage.locator('.v-card')
      .filter({ hasText: firstMatch.participant1Name })
      .filter({ hasText: firstMatch.participant2Name })
      .first();
    await firstMatchCard.click();
    await expect(publicScorePage.getByText('Scoring', { exact: true })).toBeVisible();

    for (const seededMatch of scenario.matches) {
      const overlayContext = await browser.newContext();
      contexts.push(overlayContext);
      const overlayPage = await overlayContext.newPage();
      await overlayPage.goto(`/overlay/${scenario.tournamentId}/court/${seededMatch.courtId}`);
      await expect(overlayPage.getByText(`Court ${seededMatch.courtId.split('-')[1]}`)).toBeVisible();
      overlayPages.push(overlayPage);
    }

    const scorerContexts = await Promise.all(
      scenario.scorers.map(() => browser.newContext({ ...devices['Pixel 5'] })),
    );
    contexts.push(...scorerContexts);
    const scorerPages = await Promise.all(scorerContexts.map((context) => context.newPage()));

    await Promise.all(
      scorerPages.map(async (page, index) => {
        const scorer = scenario.scorers[index];
        const match = scenario.matches[index];
        await loginAs(page, scorer.email, scorer.password);
        await openScoringPage(page, scenario.tournamentId, match);
        await assertTouchEfficientScoringPanel(page);
      }),
    );

    await Promise.all(scorerPages.map((page) => addPointsToParticipantOne(page, 1)));

    for (const overlayPage of overlayPages) {
      await expect.poll(async () => await overlayPage.getByText('LIVE').count(), { timeout: 30_000 }).toBeGreaterThan(0);
      await expect.poll(async () => await getOverlayPrimaryScore(overlayPage), { timeout: 30_000 }).toBeGreaterThan(0);
    }

    await expect.poll(
      async () => await schedulePage.getByText(/0 - 0|1 - 0|2 - 0|3 - 0/).count(),
      { timeout: 30_000 },
    ).toBeGreaterThan(0);

    await expect.poll(async () => {
      const scoreText = (await publicScorePage.locator('.score-panel .score-display').first().textContent())?.trim() || '0';
      return Number(scoreText);
    }, { timeout: 30_000 }).toBeGreaterThan(0);

    const firstScorerPage = scorerPages[0];
    await expect.poll(async () => await getParticipantOneScore(firstScorerPage), { timeout: 10_000 }).toBe(1);
    await undoParticipantOnePoint(firstScorerPage);
    await expect.poll(async () => await getParticipantOneScore(firstScorerPage), { timeout: 10_000 }).toBe(0);
    await expect(firstScorerPage.locator('.score-panel').first().locator('.score-decrement')).toBeDisabled();
    await expect.poll(async () => await getParticipantOneScore(firstScorerPage), { timeout: 5_000 }).toBe(0);

    await Promise.all(
      scorerPages.map((page, index) => addPointsToParticipantOne(page, index === 0 ? 3 : 2)),
    );

    await expect.poll(
      async () => await getCompletedMatchesCount(db, scenario),
      { timeout: 60_000 },
    ).toBe(5);

    await expect.poll(
      async () => await areFinalScoresUpdated(db, scenario),
      { timeout: 60_000 },
    ).toBe(true);

    await expect(schedulePage.getByText('Recent Results')).toBeVisible();
    await expect.poll(
      async () => await schedulePage.getByText('Games 1 - 0').count(),
      { timeout: 30_000 },
    ).toBeGreaterThanOrEqual(5);

    await expect.poll(async () => {
      const gamesText = (await publicScorePage.locator('.games-score').first().textContent()) ?? '';
      return /1\s*-\s*0/.test(gamesText);
    }, { timeout: 30_000 }).toBe(true);

    await expect.poll(async () => {
      const scoreText = (await publicScorePage.locator('.score-panel .score-display').first().textContent())?.trim() || '0';
      return Number(scoreText);
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  } finally {
    await Promise.all(contexts.map(async (context) => context.close()));
  }
});
