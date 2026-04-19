import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
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
import { createOrSignIn } from '../../scripts/seed/helpers';

export interface PoolCutScenario {
  tournamentId: string;
  categoryId: string;
  totalPlayers: number;
  defaultAdvancingCount: number;
}

interface SeedClients {
  auth: Auth;
  db: Firestore;
  adminId: string;
}

interface ScenarioPlayer {
  participantId: number;
  registrationId: string;
  playerId: string;
  firstName: string;
}

interface ScenarioMatch {
  matchId: string;
  groupId: string;
  participant1Id: number;
  participant2Id: number;
  winnerParticipantId: number;
  scores: Array<[number, number]>;
}

const TOTAL_PLAYERS = 12;
const DEFAULT_ADVANCING_COUNT = 8;

let seedClients: SeedClients | null = null;
let emulatorConnectionsReady = false;

async function getSeedClients(): Promise<SeedClients> {
  if (seedClients) {
    return seedClients;
  }

  const existingApp = getApps().find((app) => app.name === 'e2e-pool-cut-seed');
  const app = existingApp ?? initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: 'demo-courtmaster.firebaseapp.com',
      projectId: 'demo-courtmaster',
    },
    'e2e-pool-cut-seed',
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

function buildPlayers(): ScenarioPlayer[] {
  return [
    { participantId: 1, registrationId: 'reg-01', playerId: 'p-01', firstName: 'Alice' },
    { participantId: 2, registrationId: 'reg-02', playerId: 'p-02', firstName: 'Ben' },
    { participantId: 3, registrationId: 'reg-03', playerId: 'p-03', firstName: 'Carlos' },
    { participantId: 4, registrationId: 'reg-04', playerId: 'p-04', firstName: 'David' },
    { participantId: 5, registrationId: 'reg-05', playerId: 'p-05', firstName: 'Eva' },
    { participantId: 6, registrationId: 'reg-06', playerId: 'p-06', firstName: 'Frank' },
    { participantId: 7, registrationId: 'reg-07', playerId: 'p-07', firstName: 'Greg' },
    { participantId: 8, registrationId: 'reg-08', playerId: 'p-08', firstName: 'Henry' },
    { participantId: 9, registrationId: 'reg-09', playerId: 'p-09', firstName: 'Ivan' },
    { participantId: 10, registrationId: 'reg-10', playerId: 'p-10', firstName: 'Julia' },
    { participantId: 11, registrationId: 'reg-11', playerId: 'p-11', firstName: 'Kevin' },
    { participantId: 12, registrationId: 'reg-12', playerId: 'p-12', firstName: 'Lily' },
  ];
}

function buildMatches(): ScenarioMatch[] {
  return [
    { matchId: 'pool-a-1', groupId: 'group-a', participant1Id: 1, participant2Id: 2, winnerParticipantId: 1, scores: [[21, 18], [21, 16]] },
    { matchId: 'pool-a-2', groupId: 'group-a', participant1Id: 1, participant2Id: 3, winnerParticipantId: 1, scores: [[21, 16], [21, 16]] },
    { matchId: 'pool-a-3', groupId: 'group-a', participant1Id: 1, participant2Id: 4, winnerParticipantId: 1, scores: [[21, 16], [21, 13]] },
    { matchId: 'pool-a-4', groupId: 'group-a', participant1Id: 2, participant2Id: 3, winnerParticipantId: 2, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-a-5', groupId: 'group-a', participant1Id: 2, participant2Id: 4, winnerParticipantId: 2, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-a-6', groupId: 'group-a', participant1Id: 3, participant2Id: 4, winnerParticipantId: 3, scores: [[21, 19], [21, 19]] },

    { matchId: 'pool-b-1', groupId: 'group-b', participant1Id: 5, participant2Id: 6, winnerParticipantId: 5, scores: [[21, 0], [21, 0]] },
    { matchId: 'pool-b-2', groupId: 'group-b', participant1Id: 5, participant2Id: 7, winnerParticipantId: 5, scores: [[21, 0], [21, 0]] },
    { matchId: 'pool-b-3', groupId: 'group-b', participant1Id: 5, participant2Id: 8, winnerParticipantId: 5, scores: [[0, 21], [21, 0], [21, 0]] },
    { matchId: 'pool-b-4', groupId: 'group-b', participant1Id: 6, participant2Id: 7, winnerParticipantId: 6, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-b-5', groupId: 'group-b', participant1Id: 6, participant2Id: 8, winnerParticipantId: 6, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-b-6', groupId: 'group-b', participant1Id: 7, participant2Id: 8, winnerParticipantId: 7, scores: [[21, 19], [21, 19]] },

    { matchId: 'pool-c-1', groupId: 'group-c', participant1Id: 9, participant2Id: 10, winnerParticipantId: 9, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-c-2', groupId: 'group-c', participant1Id: 9, participant2Id: 11, winnerParticipantId: 9, scores: [[0, 21], [21, 19], [21, 19]] },
    { matchId: 'pool-c-3', groupId: 'group-c', participant1Id: 9, participant2Id: 12, winnerParticipantId: 9, scores: [[0, 21], [21, 19], [21, 19]] },
    { matchId: 'pool-c-4', groupId: 'group-c', participant1Id: 10, participant2Id: 11, winnerParticipantId: 10, scores: [[21, 18], [21, 19]] },
    { matchId: 'pool-c-5', groupId: 'group-c', participant1Id: 10, participant2Id: 12, winnerParticipantId: 10, scores: [[0, 21], [21, 19], [21, 19]] },
    { matchId: 'pool-c-6', groupId: 'group-c', participant1Id: 11, participant2Id: 12, winnerParticipantId: 11, scores: [[21, 19], [21, 19]] },
  ];
}

async function seedScenario(): Promise<PoolCutScenario> {
  const { db, adminId } = await getSeedClients();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const tournamentId = tournamentRef.id;
  const categoryRef = doc(collection(db, `tournaments/${tournamentId}/categories`));
  const categoryId = categoryRef.id;
  const batch = writeBatch(db);
  const players = buildPlayers();
  const matches = buildMatches();

  batch.set(tournamentRef, {
    name: `Pool Cut Scenario ${Date.now()}`,
    description: 'E2E seeded pool cut scenario',
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
    name: 'Pool Cut Singles',
    type: 'singles',
    gender: 'open',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'active',
    poolStageId: 10,
    eliminationStageId: null,
    poolGroupCount: 3,
    poolQualifiersPerGroup: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/stage/10`), {
    id: 10,
    type: 'round_robin',
    name: 'Pool Stage',
  });

  [
    { id: 'group-a', number: 1 },
    { id: 'group-b', number: 2 },
    { id: 'group-c', number: 3 },
  ].forEach((group) => {
    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/group/${group.id}`), {
      id: group.id,
      number: group.number,
      stage_id: 10,
    });
  });

  players.forEach((player) => {
    batch.set(doc(db, `tournaments/${tournamentId}/players/${player.playerId}`), {
      firstName: player.firstName,
      lastName: 'Player',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/registrations/${player.registrationId}`), {
      tournamentId,
      categoryId,
      participantType: 'player',
      playerId: player.playerId,
      status: 'approved',
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/participant/${player.participantId}`), {
      id: player.participantId,
      tournament_id: categoryId,
      name: player.registrationId,
    });
  });

  matches.forEach((match, index) => {
    const winnerRegistrationId = players.find(
      (player) => player.participantId === match.winnerParticipantId,
    )?.registrationId;
    const participant1Won = match.winnerParticipantId === match.participant1Id;

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match/${match.matchId}`), {
      id: match.matchId,
      stage_id: 10,
      round_id: `${match.groupId}-round`,
      group_id: match.groupId,
      number: index + 1,
      status: 4,
      opponent1: { id: match.participant1Id, result: participant1Won ? 'win' : 'loss' },
      opponent2: { id: match.participant2Id, result: participant1Won ? 'loss' : 'win' },
    });

    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores/${match.matchId}`), {
      status: 'completed',
      winnerId: winnerRegistrationId,
      scores: match.scores.map(([score1, score2], scoreIndex) => ({
        gameNumber: scoreIndex + 1,
        score1,
        score2,
        winnerId: score1 > score2
          ? players.find((player) => player.participantId === match.participant1Id)?.registrationId
          : players.find((player) => player.participantId === match.participant2Id)?.registrationId,
        isComplete: true,
      })),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  [
    { id: 'group-a-round', group_id: 'group-a' },
    { id: 'group-b-round', group_id: 'group-b' },
    { id: 'group-c-round', group_id: 'group-c' },
  ].forEach((round) => {
    batch.set(doc(db, `tournaments/${tournamentId}/categories/${categoryId}/round/${round.id}`), {
      id: round.id,
      stage_id: 10,
      group_id: round.group_id,
    });
  });

  await batch.commit();

  return {
    tournamentId,
    categoryId,
    totalPlayers: TOTAL_PLAYERS,
    defaultAdvancingCount: DEFAULT_ADVANCING_COUNT,
  };
}

export async function seedPoolCutScenario(): Promise<PoolCutScenario> {
  return seedScenario();
}

export async function seedPoolCutGenerateScenario(): Promise<PoolCutScenario> {
  return seedScenario();
}

export async function readQualifiedRegistrationIds(
  tournamentId: string,
  categoryId: string,
): Promise<string[]> {
  const { db } = await getSeedClients();
  const categorySnap = await getDoc(doc(db, `tournaments/${tournamentId}/categories/${categoryId}`));

  if (!categorySnap.exists()) {
    return [];
  }

  const data = categorySnap.data() as { poolQualifiedRegistrationIds?: string[] };
  return Array.isArray(data.poolQualifiedRegistrationIds) ? data.poolQualifiedRegistrationIds : [];
}
