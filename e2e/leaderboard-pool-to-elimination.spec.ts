import { test, expect } from './fixtures/auth-fixtures';
import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  serverTimestamp,
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

interface SeededLeaderboardScenario {
  tournamentId: string;
  categoryId: string;
}

let seedClients:
  | {
      auth: Auth;
      db: Firestore;
      adminId: string;
    }
  | null = null;
let emulatorConnectionsReady = false;

async function getSeedClients(): Promise<{ auth: Auth; db: Firestore; adminId: string }> {
  if (seedClients) {
    return seedClients;
  }

  const existingApp = getApps().find((app) => app.name === 'e2e-leaderboard-seed');
  const app = existingApp
    ?? initializeApp(
      {
        apiKey: 'demo-api-key',
        authDomain: 'demo-courtmaster.firebaseapp.com',
        projectId: 'demo-courtmaster',
      },
      'e2e-leaderboard-seed',
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

async function seedPoolToEliminationScenario(): Promise<SeededLeaderboardScenario> {
  const { db, adminId } = await getSeedClients();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const tournamentId = tournamentRef.id;
  const categoryRef = doc(collection(db, `tournaments/${tournamentId}/categories`));
  const categoryId = categoryRef.id;

  const batch = writeBatch(db);

  batch.set(tournamentRef, {
    name: `Leaderboard Scenario ${Date.now()}`,
    description: 'E2E seeded leaderboard pool-to-elimination scenario',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    startDate: serverTimestamp(),
    endDate: serverTimestamp(),
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 30,
      allowSelfRegistration: true,
      requireApproval: true,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
      rankingPresetDefault: 'courtmaster_default',
      progressionModeDefault: 'carry_forward',
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId,
    name: 'Mega Category Singles',
    type: 'singles',
    gender: 'open',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'active',
    seedingEnabled: false,
    poolStageId: '10',
    eliminationStageId: '11',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const registrationIds: string[] = [];

  for (let i = 1; i <= 40; i += 1) {
    const playerId = `p${i}`;
    const registrationId = `reg-${String(i).padStart(2, '0')}`;
    const participantDocId = String(i);
    registrationIds.push(registrationId);

    batch.set(doc(db, `tournaments/${tournamentId}/players/${playerId}`), {
      firstName: 'Player',
      lastName: String(i),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/registrations/${registrationId}`), {
      tournamentId,
      categoryId,
      participantType: 'player',
      playerId,
      status: 'approved',
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/participant/${participantDocId}`), {
      id: String(i),
      tournament_id: categoryId,
      name: registrationId,
    });
  }

  const regIdToParticipantId = (registrationId: string): string => {
    return String(Number(registrationId.replace('reg-', '')));
  };

  const groups: string[][] = [];
  for (let i = 0; i < registrationIds.length; i += 4) {
    groups.push(registrationIds.slice(i, i + 4));
  }

  const poolPairings: Array<[number, number, number]> = [
    [0, 1, 0],
    [0, 2, 0],
    [0, 3, 0],
    [1, 2, 1],
    [1, 3, 1],
    [2, 3, 2],
  ];

  let matchNumber = 1;
  const qualifiers: string[] = [];

  groups.forEach((group, poolIndex) => {
    poolPairings.forEach(([leftIdx, rightIdx, winnerIdx], pairIndex) => {
      const participant1RegistrationId = group[leftIdx];
      const participant2RegistrationId = group[rightIdx];
      const winnerRegistrationId = group[winnerIdx];

      const participant1Id = regIdToParticipantId(participant1RegistrationId);
      const participant2Id = regIdToParticipantId(participant2RegistrationId);
      const participant1Won = winnerRegistrationId === participant1RegistrationId;

      const matchId = `pool-${poolIndex + 1}-${pairIndex + 1}`;

      batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match/${matchId}`), {
        stage_id: '10',
        round: 1,
        number: matchNumber,
        bracket: 'winners',
        group_id: String(poolIndex + 1),
        status: 4,
        opponent1: {
          id: participant1Id,
          result: participant1Won ? 'win' : 'loss',
        },
        opponent2: {
          id: participant2Id,
          result: participant1Won ? 'loss' : 'win',
        },
      });

      batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores/${matchId}`), {
        status: 'completed',
        winnerId: winnerRegistrationId,
        scores: [
          {
            gameNumber: 1,
            score1: participant1Won ? 21 : 17,
            score2: participant1Won ? 17 : 21,
            winnerId: winnerRegistrationId,
            isComplete: true,
          },
        ],
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      matchNumber += 1;
    });

    qualifiers.push(group[0], group[1], group[2]);
  });

  const levelGroups = [
    qualifiers.slice(0, 10),
    qualifiers.slice(10, 20),
    qualifiers.slice(20, 30),
  ];

  levelGroups.forEach((levelParticipants, levelIndex) => {
    const stageId = String(11 + levelIndex);

    for (let i = 0; i < levelParticipants.length; i += 2) {
      const participant1RegistrationId = levelParticipants[i];
      const participant2RegistrationId = levelParticipants[i + 1];
      if (!participant1RegistrationId || !participant2RegistrationId) continue;

      const matchId = `level-${levelIndex + 1}-r1-${i / 2 + 1}`;
      const participant1Id = regIdToParticipantId(participant1RegistrationId);
      const participant2Id = regIdToParticipantId(participant2RegistrationId);

      batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match/${matchId}`), {
        stage_id: stageId,
        round: 2,
        number: matchNumber,
        bracket: 'winners',
        status: 4,
        opponent1: {
          id: participant1Id,
          result: 'win',
        },
        opponent2: {
          id: participant2Id,
          result: 'loss',
        },
      });

      batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores/${matchId}`), {
        status: 'completed',
        winnerId: participant1RegistrationId,
        scores: [
          {
            gameNumber: 1,
            score1: 21,
            score2: 16,
            winnerId: participant1RegistrationId,
            isComplete: true,
          },
        ],
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      matchNumber += 1;
    }
  });

  await batch.commit();

  return {
    tournamentId,
    categoryId,
  };
}

test.describe('Leaderboard UI - pool to elimination category', () => {
  test('shows pool and category leaderboard views and exports CSV', async ({ page }) => {
    const { tournamentId, categoryId } = await seedPoolToEliminationScenario();

    await page.goto(`/tournaments/${tournamentId}/categories/${categoryId}/leaderboard`);

    await expect(page.getByRole('heading', { name: /category leaderboard/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.v-skeleton-loader')).not.toBeVisible({ timeout: 15000 });

    const matchesPlayedCard = page.locator('.v-card').filter({ hasText: 'Matches Played' }).first();
    const poolScopeButton = page.getByRole('button', { name: 'Pool', exact: true });
    if ((await poolScopeButton.count()) > 0) {
      await poolScopeButton.click();
      await expect(matchesPlayedCard).toContainText('60');
      await page.getByRole('button', { name: 'Category', exact: true }).click();
    }

    await expect(matchesPlayedCard).toContainText('75');

    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.v-overlay-container').getByText('CSV', { exact: true }).first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/leaderboard-.*\.csv/i);
  });
});
