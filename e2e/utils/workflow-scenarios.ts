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
import { createOrSignIn } from '../../scripts/seed/helpers';

interface SeedClients {
  auth: Auth;
  db: Firestore;
  adminId: string;
}

type TeamCheckInState = 'checked_in' | 'partial' | 'approved';
type MatchPublishState = 'published' | 'draft';

interface TeamSeedConfig {
  key: string;
  teamName: string;
  checkInState: TeamCheckInState;
}

interface MatchSeedConfig {
  key: string;
  participant1: TeamSeedConfig;
  participant2: TeamSeedConfig;
  plannedOffsetMinutes: number;
  publishState: MatchPublishState;
  levelId?: string;
}

export interface AutoAssignWorkflowScenario {
  tournamentId: string;
  categoryId: string;
  courtId: string;
  courtName: string;
  blockedCheckInTeamName: string;
  blockedAbsentTeamName: string;
  blockedPublishTeamName: string;
  eligibleTeamName: string;
  assignedMatchId: string;
}

export interface LevelPublishWorkflowScenario {
  tournamentId: string;
  categoryId: string;
  levelId: string;
  categoryName: string;
  participantOneTeamName: string;
  participantTwoTeamName: string;
  levelMatchId: string;
}

export interface ScoringWorkflowScenario {
  tournamentId: string;
  categoryId: string;
  matchId: string;
  courtId: string;
  courtName: string;
  participantOneTeamName: string;
  participantTwoTeamName: string;
  status: 'ready' | 'completed';
}

export interface SelfRegistrationWorkflowScenario {
  tournamentId: string;
  categoryId: string;
  tournamentName: string;
}

let seedClients: SeedClients | null = null;
let emulatorConnectionsReady = false;

const getWorkflowSeedClients = async (): Promise<SeedClients> => {
  if (seedClients) return seedClients;

  const existingApp = getApps().find((app) => app.name === 'e2e-workflow-scenarios');
  const app = existingApp
    ?? initializeApp(
      {
        apiKey: 'demo-api-key',
        authDomain: 'demo-courtmaster.firebaseapp.com',
        projectId: 'demo-courtmaster',
      },
      'e2e-workflow-scenarios',
    );

  const auth = getAuth(app);
  const db = getFirestore(app);

  if (!emulatorConnectionsReady) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    emulatorConnectionsReady = true;
  }

  let adminId: string;
  try {
    const { user } = await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
    adminId = user.uid;
  } catch {
    adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
  }

  seedClients = { auth, db, adminId };
  return seedClients;
};

const getPresencePayload = (state: TeamCheckInState, playerId: string, partnerPlayerId: string): {
  status: 'approved' | 'checked_in';
  participantPresence?: Record<string, boolean>;
} => {
  if (state === 'checked_in') {
    return {
      status: 'checked_in',
      participantPresence: {
        [playerId]: true,
        [partnerPlayerId]: true,
      },
    };
  }

  if (state === 'partial') {
    return {
      status: 'approved',
      participantPresence: {
        [playerId]: true,
        [partnerPlayerId]: false,
      },
    };
  }

  return {
    status: 'approved',
    participantPresence: {},
  };
};

const seedTeamRegistration = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  team: TeamSeedConfig,
  adminId: string,
): string => {
  const player1Id = `${team.key}-p1`;
  const player2Id = `${team.key}-p2`;
  const registrationId = `reg-${team.key}`;
  const [playerOneName, playerTwoName] = team.teamName.split(' & ');
  const [playerOneFirstName, ...playerOneLastParts] = playerOneName.split(' ');
  const [playerTwoFirstName, ...playerTwoLastParts] = playerTwoName.split(' ');
  const playerOneLastName = playerOneLastParts.join(' ') || 'Player';
  const playerTwoLastName = playerTwoLastParts.join(' ') || 'Player';
  const presence = getPresencePayload(team.checkInState, player1Id, player2Id);

  batch.set(doc(db, `tournaments/${tournamentId}/players/${player1Id}`), {
    firstName: playerOneFirstName,
    lastName: playerOneLastName,
    email: `${player1Id}@courtmastr.local`,
    phone: '555-0001',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, `tournaments/${tournamentId}/players/${player2Id}`), {
    firstName: playerTwoFirstName,
    lastName: playerTwoLastName,
    email: `${player2Id}@courtmastr.local`,
    phone: '555-0002',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, `tournaments/${tournamentId}/registrations/${registrationId}`), {
    tournamentId,
    categoryId,
    participantType: 'team',
    playerId: player1Id,
    partnerPlayerId: player2Id,
    teamName: team.teamName,
    status: presence.status,
    participantPresence: presence.participantPresence ?? {},
    registeredBy: adminId,
    registeredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return registrationId;
};

const seedScopeMatches = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  basePath: string,
  matches: MatchSeedConfig[],
  adminId: string,
): Map<string, string> => {
  const participantIdByRegistrationId = new Map<string, string>();
  let participantNumber = 1;
  const now = Date.now();

  for (const match of matches) {
    const registration1Id = seedTeamRegistration(batch, db, tournamentId, categoryId, match.participant1, adminId);
    const registration2Id = seedTeamRegistration(batch, db, tournamentId, categoryId, match.participant2, adminId);

    if (!participantIdByRegistrationId.has(registration1Id)) {
      const participantId = String(participantNumber++);
      participantIdByRegistrationId.set(registration1Id, participantId);
      batch.set(doc(db, `${basePath}/participant/${participantId}`), {
        id: participantId,
        tournament_id: categoryId,
        name: registration1Id,
      });
    }

    if (!participantIdByRegistrationId.has(registration2Id)) {
      const participantId = String(participantNumber++);
      participantIdByRegistrationId.set(registration2Id, participantId);
      batch.set(doc(db, `${basePath}/participant/${participantId}`), {
        id: participantId,
        tournament_id: categoryId,
        name: registration2Id,
      });
    }

    const matchId = `match-${match.key}`;
    const plannedStart = new Date(now + match.plannedOffsetMinutes * 60_000);
    const plannedEnd = new Date(plannedStart.getTime() + 20 * 60_000);

    batch.set(doc(db, `${basePath}/match/${matchId}`), {
      stage_id: categoryId,
      round: 1,
      bracket: 'winners',
      number: participantNumber,
      status: 2,
      opponent1: { id: participantIdByRegistrationId.get(registration1Id) },
      opponent2: { id: participantIdByRegistrationId.get(registration2Id) },
      child_count: 0,
    });

    batch.set(doc(db, `${basePath}/match_scores/${matchId}`), {
      tournamentId,
      participant1Id: registration1Id,
      participant2Id: registration2Id,
      plannedStartAt: Timestamp.fromDate(plannedStart),
      plannedEndAt: Timestamp.fromDate(plannedEnd),
      scheduleStatus: match.publishState,
      publishedAt: match.publishState === 'published' ? serverTimestamp() : null,
      status: 'ready',
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
  }

  return participantIdByRegistrationId;
};

export const seedAutoAssignWorkflowScenario = async (): Promise<AutoAssignWorkflowScenario> => {
  const { db, adminId } = await getWorkflowSeedClients();
  const timestamp = Date.now();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const categoryRef = doc(collection(db, `tournaments/${tournamentRef.id}/categories`));
  const courtId = 'court-1';
  const courtName = 'Court 1';
  const basePath = `tournaments/${tournamentRef.id}/categories/${categoryRef.id}`;
  const batch = writeBatch(db);

  batch.set(tournamentRef, {
    name: `Workflow Auto Assign ${timestamp}`,
    description: 'Deterministic E2E workflow scenario for check-in and auto-assign',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'active',
    state: 'LIVE',
    startDate: serverTimestamp(),
    endDate: serverTimestamp(),
    settings: {
      minRestTimeMinutes: 0,
      matchDurationMinutes: 20,
      autoAssignEnabled: true,
      autoAssignDueWindowMinutes: 10,
      allowSelfRegistration: false,
      requireApproval: true,
      gamesPerMatch: 1,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId: tournamentRef.id,
    name: "Men's Doubles Workflow",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'active',
    seedingEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, `tournaments/${tournamentRef.id}/courts/${courtId}`), {
    name: courtName,
    number: 1,
    status: 'available',
    currentMatchId: null,
    assignedMatchId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  seedScopeMatches(
    batch,
    db,
    tournamentRef.id,
    categoryRef.id,
    basePath,
    [
      {
        key: 'partial',
        participant1: {
          key: 'partial-home',
          teamName: 'Partial Pair & Checked Mate',
          checkInState: 'partial',
        },
        participant2: {
          key: 'partial-away',
          teamName: 'Ready Pair & Full Team',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: 1,
        publishState: 'published',
      },
      {
        key: 'absent',
        participant1: {
          key: 'absent-home',
          teamName: 'No Show One & No Show Two',
          checkInState: 'approved',
        },
        participant2: {
          key: 'absent-away',
          teamName: 'Checked In Three & Checked In Four',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: 2,
        publishState: 'published',
      },
      {
        key: 'draft',
        participant1: {
          key: 'draft-home',
          teamName: 'Draft Team A & Draft Team B',
          checkInState: 'checked_in',
        },
        participant2: {
          key: 'draft-away',
          teamName: 'Draft Team C & Draft Team D',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: 3,
        publishState: 'draft',
      },
      {
        key: 'eligible',
        participant1: {
          key: 'eligible-home',
          teamName: 'Ready Team A & Ready Team B',
          checkInState: 'checked_in',
        },
        participant2: {
          key: 'eligible-away',
          teamName: 'Ready Team C & Ready Team D',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: 4,
        publishState: 'published',
      },
    ],
    adminId,
  );

  await batch.commit();

  return {
    tournamentId: tournamentRef.id,
    categoryId: categoryRef.id,
    courtId,
    courtName,
    blockedCheckInTeamName: 'Partial Pair & Checked Mate',
    blockedAbsentTeamName: 'No Show One & No Show Two',
    blockedPublishTeamName: 'Draft Team A & Draft Team B',
    eligibleTeamName: 'Ready Team A & Ready Team B',
    assignedMatchId: 'match-eligible',
  };
};

export const seedLevelPublishWorkflowScenario = async (): Promise<LevelPublishWorkflowScenario> => {
  const { db, adminId } = await getWorkflowSeedClients();
  const timestamp = Date.now();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const categoryRef = doc(collection(db, `tournaments/${tournamentRef.id}/categories`));
  const levelId = 'level-a';
  const basePath = `tournaments/${tournamentRef.id}/categories/${categoryRef.id}/levels/${levelId}`;
  const batch = writeBatch(db);

  batch.set(tournamentRef, {
    name: `Workflow Level Publish ${timestamp}`,
    description: 'Deterministic E2E workflow scenario for level publish CTA',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    startDate: serverTimestamp(),
    endDate: serverTimestamp(),
    settings: {
      minRestTimeMinutes: 0,
      matchDurationMinutes: 20,
      autoAssignEnabled: true,
      autoAssignDueWindowMinutes: 10,
      allowSelfRegistration: false,
      requireApproval: true,
      gamesPerMatch: 1,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId: tournamentRef.id,
    name: "Men's Doubles Levels",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'active',
    seedingEnabled: false,
    levelingStatus: 'generated',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, `tournaments/${tournamentRef.id}/categories/${categoryRef.id}/levels/${levelId}`), {
    name: 'Level A',
    order: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  seedScopeMatches(
    batch,
    db,
    tournamentRef.id,
    categoryRef.id,
    basePath,
    [
      {
        key: 'level-1',
        participant1: {
          key: 'level-home',
          teamName: 'Publish Pair One & Publish Pair Two',
          checkInState: 'checked_in',
        },
        participant2: {
          key: 'level-away',
          teamName: 'Publish Pair Three & Publish Pair Four',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: 15,
        publishState: 'draft',
        levelId,
      },
    ],
    adminId,
  );

  await batch.commit();

  return {
    tournamentId: tournamentRef.id,
    categoryId: categoryRef.id,
    levelId,
    categoryName: "Men's Doubles Levels",
    participantOneTeamName: 'Publish Pair One & Publish Pair Two',
    participantTwoTeamName: 'Publish Pair Three & Publish Pair Four',
    levelMatchId: 'match-level-1',
  };
};

export const seedScoringWorkflowScenario = async (
  status: 'ready' | 'completed' = 'ready',
): Promise<ScoringWorkflowScenario> => {
  const { db, adminId } = await getWorkflowSeedClients();
  const timestamp = Date.now();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const categoryRef = doc(collection(db, `tournaments/${tournamentRef.id}/categories`));
  const batch = writeBatch(db);
  const courtId = 'court-1';
  const courtName = 'Court 1';
  const basePath = `tournaments/${tournamentRef.id}/categories/${categoryRef.id}`;

  batch.set(tournamentRef, {
    name: `Workflow Scoring ${status} ${timestamp}`,
    description: 'Deterministic E2E workflow scenario for scoring flows',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'active',
    state: 'LIVE',
    startDate: serverTimestamp(),
    endDate: serverTimestamp(),
    settings: {
      minRestTimeMinutes: 0,
      matchDurationMinutes: 20,
      autoAssignEnabled: false,
      autoAssignDueWindowMinutes: 10,
      allowSelfRegistration: false,
      requireApproval: true,
      gamesPerMatch: 1,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId: tournamentRef.id,
    name: "Men's Singles Scoring",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'active',
    seedingEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, `tournaments/${tournamentRef.id}/courts/${courtId}`), {
    name: courtName,
    number: 1,
    status: status === 'completed' ? 'available' : 'occupied',
    currentMatchId: status === 'completed' ? null : 'match-scoreable',
    assignedMatchId: 'match-scoreable',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  seedScopeMatches(
    batch,
    db,
    tournamentRef.id,
    categoryRef.id,
    basePath,
    [
      {
        key: 'scoreable',
        participant1: {
          key: 'scoreable-home',
          teamName: 'Scoring Home Player & Placeholder One',
          checkInState: 'checked_in',
        },
        participant2: {
          key: 'scoreable-away',
          teamName: 'Scoring Away Player & Placeholder Two',
          checkInState: 'checked_in',
        },
        plannedOffsetMinutes: -5,
        publishState: 'published',
      },
    ],
    adminId,
  );

  const scoreRef = doc(db, `${basePath}/match_scores/match-scoreable`);
  batch.update(scoreRef, status === 'completed'
    ? {
      status: 'completed',
      courtId,
      startedAt: Timestamp.fromDate(new Date(timestamp - 20 * 60_000)),
      completedAt: Timestamp.fromDate(new Date(timestamp - 2 * 60_000)),
      winnerId: 'reg-scoreable-home',
      scores: [
        {
          gameNumber: 1,
          score1: 21,
          score2: 15,
          isComplete: true,
        },
      ],
      updatedAt: serverTimestamp(),
    }
    : {
      status: 'ready',
      courtId,
      startedAt: null,
      completedAt: null,
      winnerId: null,
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

  await batch.commit();

  return {
    tournamentId: tournamentRef.id,
    categoryId: categoryRef.id,
    matchId: 'match-scoreable',
    courtId,
    courtName,
    participantOneTeamName: 'Scoring Home Player & Placeholder One',
    participantTwoTeamName: 'Scoring Away Player & Placeholder Two',
    status,
  };
};

export const seedSelfRegistrationWorkflowScenario = async (): Promise<SelfRegistrationWorkflowScenario> => {
  const { db, adminId } = await getWorkflowSeedClients();
  const timestamp = Date.now();
  const tournamentRef = doc(collection(db, 'tournaments'));
  const categoryRef = doc(collection(db, `tournaments/${tournamentRef.id}/categories`));
  const tournamentName = `SelfReg Tournament ${timestamp}`;
  const batch = writeBatch(db);

  batch.set(tournamentRef, {
    name: tournamentName,
    description: 'Deterministic E2E workflow scenario for self-registration',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'registration',
    state: 'REGISTRATION',
    startDate: Timestamp.fromDate(new Date(timestamp + 24 * 60 * 60_000)),
    endDate: Timestamp.fromDate(new Date(timestamp + 48 * 60 * 60_000)),
    settings: {
      minRestTimeMinutes: 0,
      matchDurationMinutes: 20,
      autoAssignEnabled: false,
      autoAssignDueWindowMinutes: 10,
      allowSelfRegistration: true,
      requireApproval: true,
      gamesPerMatch: 1,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(categoryRef, {
    tournamentId: tournamentRef.id,
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'active',
    seedingEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    tournamentId: tournamentRef.id,
    categoryId: categoryRef.id,
    tournamentName,
  };
};

export const getMatchScoreData = async (
  tournamentId: string,
  categoryId: string,
  matchId: string,
  levelId?: string,
): Promise<Record<string, unknown> | undefined> => {
  const { db } = await getWorkflowSeedClients();
  const path = levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores/${matchId}`
    : `tournaments/${tournamentId}/categories/${categoryId}/match_scores/${matchId}`;
  const snap = await getDoc(doc(db, path));
  return snap.data();
};
