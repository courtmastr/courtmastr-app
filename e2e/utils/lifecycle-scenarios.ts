import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import { createOrSignIn, seedGlobalPlayer } from '../../scripts/seed/helpers';

interface SeedClients {
  auth: Auth;
  db: Firestore;
  adminId: string;
}

interface TeamSeed {
  index: number;
  registrationId: string;
  participantId: string;
  teamName: string;
  playerOne: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  playerTwo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

interface SeededTeam extends TeamSeed {
  playerOneId: string;
  playerTwoId: string;
}

interface LifecycleLevel {
  id: string;
  name: string;
  order: number;
  registrationIds: string[];
}

export interface LifecycleScenario {
  orgId: string;
  orgSlug: string;
  orgName: string;
  tournamentId: string;
  tournamentName: string;
  categoryId: string;
  categoryName: string;
  representativePlayerId: string;
  representativePlayerName: string;
  representativeTeamName: string;
  finalistPlayerId: string;
  finalistPlayerName: string;
  finalistTeamName: string;
  publicLeaderboardTeamName: string;
  expected: {
    registrationCount: number;
    tournamentPlayerCount: number;
    poolMatchCount: number;
    completedPoolMatchCount: number;
    levelCount: number;
    completedLevelMatchCount: number;
    totalCompletedMatches: number;
    checkedInRegistrations: number;
  };
}

export interface LifecycleSnapshot {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgLogoUrl?: string | null;
  orgBannerUrl?: string | null;
  sponsorCount: number;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus?: string;
  tournamentState?: string;
  categoryId: string;
  categoryName: string;
  categoryStatus?: string;
  registrationCount: number;
  checkedInRegistrations: number;
  tournamentPlayerCount: number;
  globalPlayerCount: number;
  allRegistrationEmailsPresent: boolean;
  poolMatchCount: number;
  completedPoolMatchCount: number;
  levelCount: number;
  completedLevelMatchCount: number;
}

export interface LifecyclePlayerSnapshot {
  playerId: string;
  playerName: string;
  overallWins: number;
  overallLosses: number;
  tournamentsPlayed: number;
  doublesWins: number;
  doublesLosses: number;
}

const ORG_SLUG = 'courtmastr-lifecycle-club';
const ORG_NAME = 'CourtMastr Lifecycle Club';
const TOURNAMENT_ID = 'e2e-lifecycle-tournament';
const TOURNAMENT_NAME = 'CourtMastr Lifecycle Championship';
const CATEGORY_ID = 'e2e-lifecycle-md';
const CATEGORY_NAME = "Men's Doubles";
const LEVELS: LifecycleLevel[] = [
  {
    id: 'e2e-lifecycle-gold',
    name: 'Gold Flight',
    order: 1,
    registrationIds: ['life-reg-01', 'life-reg-02', 'life-reg-05', 'life-reg-06'],
  },
  {
    id: 'e2e-lifecycle-silver',
    name: 'Silver Flight',
    order: 2,
    registrationIds: ['life-reg-09', 'life-reg-10', 'life-reg-13', 'life-reg-14'],
  },
  {
    id: 'e2e-lifecycle-bronze',
    name: 'Bronze Flight',
    order: 3,
    registrationIds: ['life-reg-17', 'life-reg-18', 'life-reg-21', 'life-reg-22'],
  },
];
const COURT_IDS = ['life-court-1', 'life-court-2', 'life-court-3', 'life-court-4', 'life-court-5', 'life-court-6'];
const BASE_DATE = new Date('2026-02-14T09:00:00.000Z');
const TOURNAMENT_START = Timestamp.fromDate(new Date('2026-02-14T09:00:00.000Z'));
const TOURNAMENT_END = Timestamp.fromDate(new Date('2026-02-16T22:00:00.000Z'));

let seedClients: SeedClients | null = null;
let emulatorConnectionsReady = false;

const levelChampionByLevelId: Record<string, string> = {
  'e2e-lifecycle-gold': 'life-reg-01',
  'e2e-lifecycle-silver': 'life-reg-09',
  'e2e-lifecycle-bronze': 'life-reg-17',
};

const getLifecycleSeedClients = async (): Promise<SeedClients> => {
  if (seedClients) return seedClients;

  const existingApp = getApps().find((app) => app.name === 'e2e-lifecycle-scenarios');
  const app = existingApp
    ?? initializeApp(
      {
        apiKey: 'demo-api-key',
        authDomain: 'demo-courtmaster.firebaseapp.com',
        projectId: 'demo-courtmaster',
      },
      'e2e-lifecycle-scenarios',
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

const tsMinutes = (offsetMinutes: number): Timestamp =>
  Timestamp.fromDate(new Date(BASE_DATE.getTime() + offsetMinutes * 60_000));

const buildTeams = (): TeamSeed[] => {
  const firstNames = [
    'Aiden', 'Bryce', 'Caleb', 'Dev', 'Ethan', 'Faris', 'Gavin', 'Harsh',
    'Ilan', 'Jared', 'Kiran', 'Logan', 'Milan', 'Nikhil', 'Owen', 'Pranav',
    'Quinn', 'Rohan', 'Shiv', 'Taran', 'Uday', 'Varun', 'Wes', 'Xavier',
    'Yash', 'Zane', 'Arjun', 'Bhavesh', 'Chris', 'Dhruv', 'Eli', 'Faiz',
    'Grant', 'Hitesh', 'Ishaan', 'Jay', 'Kunal', 'Liam', 'Manav', 'Noah',
    'Om', 'Parth', 'Rishi', 'Sahil', 'Tejas', 'Utkarsh', 'Vihaan', 'Wyatt',
    'Yuvan', 'Zayd', 'Aarav', 'Bodhi', 'Cyrus', 'Daksh', 'Emil', 'Finn',
  ];
  const lastNames = [
    'Patel', 'Shah', 'Rao', 'Gupta', 'Kumar', 'Menon', 'Iyer', 'Trivedi',
    'Yadav', 'Patnaik', 'Reddy', 'Srinivasan', 'Mukku', 'Mishra', 'Singh', 'Joshi',
    'Desai', 'Chaudhary', 'Nair', 'Prakash', 'Madan', 'Kapoor', 'Bhat', 'Narayan',
    'Saxena', 'Verma', 'Jain', 'Sethi',
  ];

  return Array.from({ length: 28 }, (_, index) => {
    const playerOneIndex = index * 2;
    const playerTwoIndex = playerOneIndex + 1;
    const padded = String(index + 1).padStart(2, '0');
    const playerOneFirstName = firstNames[playerOneIndex];
    const playerTwoFirstName = firstNames[playerTwoIndex];
    const playerOneLastName = lastNames[index % lastNames.length];
    const playerTwoLastName = lastNames[(index + 7) % lastNames.length];

    return {
      index,
      registrationId: `life-reg-${padded}`,
      participantId: String(index + 1),
      teamName: `${playerOneFirstName} ${playerOneLastName} & ${playerTwoFirstName} ${playerTwoLastName}`,
      playerOne: {
        firstName: playerOneFirstName,
        lastName: playerOneLastName,
        email: `lifecycle.team${padded}.one@courtmastr.local`,
        phone: `555-100${padded}`,
      },
      playerTwo: {
        firstName: playerTwoFirstName,
        lastName: playerTwoLastName,
        email: `lifecycle.team${padded}.two@courtmastr.local`,
        phone: `555-200${padded}`,
      },
    };
  });
};

const createRegistrationLookup = (teams: SeededTeam[]): Map<string, SeededTeam> => (
  new Map(teams.map((team) => [team.registrationId, team]))
);

const writeParticipantDocs = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  basePath: string,
  registrationIds: string[],
): void => {
  registrationIds.forEach((registrationId, index) => {
    batch.set(doc(db, `${basePath}/participant/${index + 1}`), {
      id: String(index + 1),
      tournament_id: CATEGORY_ID,
      name: registrationId,
    });
  });
};

const writePoolStructures = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
): void => {
  batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/round/pool-round-1`), {
    id: 'pool-round-1',
    number: 1,
    group_id: 1,
  });

  for (let groupNumber = 1; groupNumber <= 7; groupNumber += 1) {
    batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/group/${groupNumber}`), {
      id: String(groupNumber),
      number: groupNumber,
    });
  }
};

const writePoolMatches = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  teams: SeededTeam[],
): string[] => {
  const completedMatches: string[] = [];
  const poolPairings: Array<[number, number, number]> = [
    [0, 1, 0],
    [2, 3, 2],
    [0, 2, 0],
    [1, 3, 1],
    [0, 3, 0],
    [1, 2, 1],
  ];

  let matchNumber = 1;

  for (let groupIndex = 0; groupIndex < 7; groupIndex += 1) {
    const groupTeams = teams.slice(groupIndex * 4, groupIndex * 4 + 4);

    poolPairings.forEach(([left, right, winner], pairIndex) => {
      const participant1 = groupTeams[left];
      const participant2 = groupTeams[right];
      const winnerRegistrationId = groupTeams[winner].registrationId;
      const matchId = `life-pool-g${groupIndex + 1}-m${pairIndex + 1}`;
      const startedAt = tsMinutes((groupIndex * 60) + (pairIndex * 20));
      const completedAt = tsMinutes((groupIndex * 60) + (pairIndex * 20) + 15);

      batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/match/${matchId}`), {
        stage_id: '10',
        round: 1,
        bracket: 'winners',
        group_id: String(groupIndex + 1),
        number: matchNumber,
        status: 4,
        child_count: 0,
        opponent1: {
          id: participant1.participantId,
          result: winnerRegistrationId === participant1.registrationId ? 'win' : 'loss',
        },
        opponent2: {
          id: participant2.participantId,
          result: winnerRegistrationId === participant2.registrationId ? 'win' : 'loss',
        },
      });

      batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/match_scores/${matchId}`), {
        tournamentId: TOURNAMENT_ID,
        categoryId: CATEGORY_ID,
        participant1Id: participant1.registrationId,
        participant2Id: participant2.registrationId,
        winnerId: winnerRegistrationId,
        status: 'completed',
        scores: [
          {
            gameNumber: 1,
            score1: winnerRegistrationId === participant1.registrationId ? 21 : 16,
            score2: winnerRegistrationId === participant2.registrationId ? 21 : 16,
            winnerId: winnerRegistrationId,
            isComplete: true,
          },
        ],
        scheduleStatus: 'published',
        scheduleVersion: 1,
        plannedStartAt: startedAt,
        plannedEndAt: completedAt,
        publishedAt: startedAt,
        publishedBy: 'admin@courtmastr.com',
        startedAt,
        completedAt,
        updatedAt: completedAt,
      });

      completedMatches.push(matchId);
      matchNumber += 1;
    });
  }

  return completedMatches;
};

const writeLevelMatches = (
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  registrationLookup: Map<string, SeededTeam>,
): string[] => {
  const completedMatches: string[] = [];

  LEVELS.forEach((level, levelIndex) => {
    const levelBasePath = `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/levels/${level.id}`;
    batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/levels/${level.id}`), {
      id: level.id,
      name: level.name,
      order: level.order,
      eliminationFormat: 'single_elimination',
      participantCount: level.registrationIds.length,
      stageId: String(20 + levelIndex),
      createdAt: TOURNAMENT_START,
      updatedAt: TOURNAMENT_END,
    });
    batch.set(doc(db, `${levelBasePath}/group/1`), {
      id: '1',
      number: 1,
    });
    batch.set(doc(db, `${levelBasePath}/round/semi`), {
      id: 'semi',
      number: 1,
      group_id: 1,
    });
    batch.set(doc(db, `${levelBasePath}/round/final`), {
      id: 'final',
      number: 2,
      group_id: 1,
    });
    writeParticipantDocs(batch, db, levelBasePath, level.registrationIds);

    const registrations = level.registrationIds.map((registrationId) => {
      const team = registrationLookup.get(registrationId);
      if (!team) {
        throw new Error(`Missing seeded team for registration ${registrationId}`);
      }
      return team;
    });

    const matches = [
      {
        id: `${level.id}-semi-1`,
        round: 1,
        number: 1,
        opponent1: registrations[0],
        opponent2: registrations[1],
        winnerId: registrations[0].registrationId,
        offsetMinutes: 480 + (levelIndex * 60),
      },
      {
        id: `${level.id}-semi-2`,
        round: 1,
        number: 2,
        opponent1: registrations[2],
        opponent2: registrations[3],
        winnerId: registrations[2].registrationId,
        offsetMinutes: 500 + (levelIndex * 60),
      },
      {
        id: `${level.id}-final`,
        round: 2,
        number: 3,
        opponent1: registrations[0],
        opponent2: registrations[2],
        winnerId: levelChampionByLevelId[level.id],
        offsetMinutes: 540 + (levelIndex * 60),
      },
    ];

    matches.forEach((match) => {
      const startedAt = tsMinutes(match.offsetMinutes);
      const completedAt = tsMinutes(match.offsetMinutes + 18);
      batch.set(doc(db, `${levelBasePath}/match/${match.id}`), {
        stage_id: String(20 + levelIndex),
        round: match.round,
        bracket: 'winners',
        number: match.number,
        status: 4,
        child_count: 0,
        opponent1: {
          id: String(level.registrationIds.indexOf(match.opponent1.registrationId) + 1),
          result: match.winnerId === match.opponent1.registrationId ? 'win' : 'loss',
        },
        opponent2: {
          id: String(level.registrationIds.indexOf(match.opponent2.registrationId) + 1),
          result: match.winnerId === match.opponent2.registrationId ? 'win' : 'loss',
        },
      });

      batch.set(doc(db, `${levelBasePath}/match_scores/${match.id}`), {
        tournamentId: TOURNAMENT_ID,
        categoryId: CATEGORY_ID,
        levelId: level.id,
        participant1Id: match.opponent1.registrationId,
        participant2Id: match.opponent2.registrationId,
        winnerId: match.winnerId,
        status: 'completed',
        scores: [
          {
            gameNumber: 1,
            score1: match.winnerId === match.opponent1.registrationId ? 21 : 15,
            score2: match.winnerId === match.opponent2.registrationId ? 21 : 15,
            winnerId: match.winnerId,
            isComplete: true,
          },
        ],
        scheduleStatus: 'published',
        scheduleVersion: 1,
        plannedStartAt: startedAt,
        plannedEndAt: completedAt,
        publishedAt: startedAt,
        publishedBy: 'admin@courtmastr.com',
        startedAt,
        completedAt,
        updatedAt: completedAt,
      });

      completedMatches.push(match.id);
    });
  });

  return completedMatches;
};

const upsertPlayerStats = async (
  db: Firestore,
  playerId: string,
  stats: {
    overallWins: number;
    overallLosses: number;
    gamesPlayed: number;
    tournamentsPlayed: number;
  },
): Promise<void> => {
  await updateDoc(doc(db, 'players', playerId), {
    stats: {
      overall: {
        wins: stats.overallWins,
        losses: stats.overallLosses,
        gamesPlayed: stats.gamesPlayed,
        tournamentsPlayed: stats.tournamentsPlayed,
      },
      badminton: {
        doubles: {
          wins: stats.overallWins,
          losses: stats.overallLosses,
          gamesPlayed: stats.gamesPlayed,
          tournamentsPlayed: stats.tournamentsPlayed,
        },
      },
    },
    updatedAt: TOURNAMENT_END,
  });
};

export const seedCompletedLifecycleScenario = async (): Promise<LifecycleScenario> => {
  const { db, adminId } = await getLifecycleSeedClients();
  const orgSlugSnap = await getDoc(doc(db, 'orgSlugIndex', ORG_SLUG));
  const orgId = orgSlugSnap.exists() ? (orgSlugSnap.data().orgId as string) : `org-${ORG_SLUG}`;

  const teams = buildTeams();
  const emailIdCache = new Map<string, string>();
  const seededTeams: SeededTeam[] = [];

  for (const team of teams) {
    const playerOneId = await seedGlobalPlayer(db, TOURNAMENT_ID, {
      firstName: team.playerOne.firstName,
      lastName: team.playerOne.lastName,
      email: team.playerOne.email,
      phone: team.playerOne.phone,
      gender: 'male',
      skillLevel: 4,
    }, emailIdCache);
    const playerTwoId = await seedGlobalPlayer(db, TOURNAMENT_ID, {
      firstName: team.playerTwo.firstName,
      lastName: team.playerTwo.lastName,
      email: team.playerTwo.email,
      phone: team.playerTwo.phone,
      gender: 'male',
      skillLevel: 4,
    }, emailIdCache);

    seededTeams.push({
      ...team,
      playerOneId,
      playerTwoId,
    });
  }

  const representativeTeam = seededTeams[0];
  const finalistTeam = seededTeams[1];
  const registrationLookup = createRegistrationLookup(seededTeams);
  const batch = writeBatch(db);

  batch.set(doc(db, 'orgSlugIndex', ORG_SLUG), {
    orgId,
    createdAt: TOURNAMENT_START,
  });
  batch.set(doc(db, 'organizations', orgId), {
    id: orgId,
    name: ORG_NAME,
    slug: ORG_SLUG,
    logoUrl: null,
    bannerUrl: null,
    contactEmail: 'hello@courtmastr-lifecycle.local',
    timezone: 'America/Chicago',
    about: 'CourtMastr lifecycle org used for deterministic E2E branding, tournament, and completion coverage.',
    website: 'https://courtmastr.local/lifecycle',
    city: 'Chicago, IL',
    foundedYear: 2018,
    socialLinks: {
      instagram: '@courtmastr_lifecycle',
      facebook: 'courtmastr.lifecycle',
      youtube: '@courtmastrlifecycle',
      twitter: '@courtmastrlife',
    },
    sponsors: [],
    createdAt: TOURNAMENT_START,
    updatedAt: TOURNAMENT_END,
  });
  batch.set(doc(db, `organizations/${orgId}/members/${adminId}`), {
    uid: adminId,
    role: 'admin',
    joinedAt: TOURNAMENT_START,
  });
  batch.set(doc(db, 'users', adminId), {
    email: 'admin@courtmastr.com',
    displayName: 'Tournament Admin',
    role: 'admin',
    activeOrgId: orgId,
    updatedAt: TOURNAMENT_END,
  }, { merge: true });

  batch.set(doc(db, 'tournaments', TOURNAMENT_ID), {
    name: TOURNAMENT_NAME,
    description: 'Deterministic tournament used to cover organization branding, completion flow, player profile updates, and public results.',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'completed',
    state: 'COMPLETED',
    location: 'Chicago Fieldhouse',
    orgId,
    createdBy: adminId,
    organizerIds: [adminId],
    startDate: TOURNAMENT_START,
    endDate: TOURNAMENT_END,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 25,
      bufferMinutes: 5,
      allowSelfRegistration: false,
      requireApproval: true,
      autoAssignEnabled: true,
      autoStartEnabled: false,
      autoReadyLeadMinutes: 10,
      autoAssignDueWindowMinutes: 10,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
      rankingPresetDefault: 'courtmaster_default',
      progressionModeDefault: 'carry_forward',
    },
    createdAt: TOURNAMENT_START,
    updatedAt: TOURNAMENT_END,
  });

  batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}`), {
    tournamentId: TOURNAMENT_ID,
    name: CATEGORY_NAME,
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'completed',
    seedingEnabled: true,
    poolStageId: 10,
    eliminationStageId: 20,
    poolPhase: 'elimination',
    poolGroupCount: 7,
    poolQualifiersPerGroup: 2,
    teamsPerPool: 4,
    poolSeedingMethod: 'serpentine',
    levelingEnabled: true,
    levelingStatus: 'generated',
    recommendedLevelMode: 'pool_position',
    selectedLevelMode: 'pool_position',
    levelCount: LEVELS.length,
    levelsVersion: 1,
    poolCompletedAt: tsMinutes(420),
    poolQualifiedRegistrationIds: LEVELS.flatMap((level) => level.registrationIds),
    checkInOpen: false,
    checkInClosedAt: tsMinutes(-60),
    createdAt: TOURNAMENT_START,
    updatedAt: TOURNAMENT_END,
  });

  COURT_IDS.forEach((courtId, index) => {
    batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/courts/${courtId}`), {
      id: courtId,
      name: `Court ${index + 1}`,
      number: index + 1,
      status: 'available',
      currentMatchId: null,
      assignedMatchId: null,
      createdAt: TOURNAMENT_START,
      updatedAt: TOURNAMENT_END,
    });
  });

  seededTeams.forEach((team) => {
    batch.set(doc(db, `tournaments/${TOURNAMENT_ID}/registrations/${team.registrationId}`), {
      tournamentId: TOURNAMENT_ID,
      categoryId: CATEGORY_ID,
      participantType: 'team',
      playerId: team.playerOneId,
      partnerPlayerId: team.playerTwoId,
      teamName: team.teamName,
      status: 'checked_in',
      participantPresence: {
        [team.playerOneId]: true,
        [team.playerTwoId]: true,
      },
      seed: team.index + 1,
      registeredBy: adminId,
      registeredAt: TOURNAMENT_START,
      approvedAt: TOURNAMENT_START,
      checkedInAt: tsMinutes(-30),
      createdAt: TOURNAMENT_START,
      updatedAt: TOURNAMENT_END,
    });
  });

  writeParticipantDocs(
    batch,
    db,
    `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}`,
    seededTeams.map((team) => team.registrationId),
  );
  writePoolStructures(batch, db);
  const completedPoolMatches = writePoolMatches(batch, db, seededTeams);
  const completedLevelMatches = writeLevelMatches(batch, db, registrationLookup);

  await batch.commit();

  await upsertPlayerStats(db, representativeTeam.playerOneId, {
    overallWins: 5,
    overallLosses: 0,
    gamesPlayed: 5,
    tournamentsPlayed: 1,
  });
  await upsertPlayerStats(db, representativeTeam.playerTwoId, {
    overallWins: 5,
    overallLosses: 0,
    gamesPlayed: 5,
    tournamentsPlayed: 1,
  });
  await upsertPlayerStats(db, finalistTeam.playerOneId, {
    overallWins: 4,
    overallLosses: 1,
    gamesPlayed: 5,
    tournamentsPlayed: 1,
  });
  await upsertPlayerStats(db, finalistTeam.playerTwoId, {
    overallWins: 4,
    overallLosses: 1,
    gamesPlayed: 5,
    tournamentsPlayed: 1,
  });

  return {
    orgId,
    orgSlug: ORG_SLUG,
    orgName: ORG_NAME,
    tournamentId: TOURNAMENT_ID,
    tournamentName: TOURNAMENT_NAME,
    categoryId: CATEGORY_ID,
    categoryName: CATEGORY_NAME,
    representativePlayerId: representativeTeam.playerOneId,
    representativePlayerName: `${representativeTeam.playerOne.firstName} ${representativeTeam.playerOne.lastName}`,
    representativeTeamName: representativeTeam.teamName,
    finalistPlayerId: finalistTeam.playerOneId,
    finalistPlayerName: `${finalistTeam.playerOne.firstName} ${finalistTeam.playerOne.lastName}`,
    finalistTeamName: finalistTeam.teamName,
    publicLeaderboardTeamName: representativeTeam.teamName,
    expected: {
      registrationCount: seededTeams.length,
      tournamentPlayerCount: seededTeams.length * 2,
      poolMatchCount: 42,
      completedPoolMatchCount: completedPoolMatches.length,
      levelCount: LEVELS.length,
      completedLevelMatchCount: completedLevelMatches.length,
      totalCompletedMatches: completedPoolMatches.length + completedLevelMatches.length,
      checkedInRegistrations: seededTeams.length,
    },
  };
};

export const getLifecycleSnapshot = async (): Promise<LifecycleSnapshot> => {
  const { db } = await getLifecycleSeedClients();
  const orgSlugSnap = await getDoc(doc(db, 'orgSlugIndex', ORG_SLUG));
  const orgId = orgSlugSnap.exists() ? (orgSlugSnap.data().orgId as string) : `org-${ORG_SLUG}`;

  const [
    orgSnap,
    tournamentSnap,
    categorySnap,
    registrationSnap,
    tournamentPlayersSnap,
    globalPlayersSnap,
    poolScoresSnap,
    levelsSnap,
  ] = await Promise.all([
    getDoc(doc(db, 'organizations', orgId)),
    getDoc(doc(db, 'tournaments', TOURNAMENT_ID)),
    getDoc(doc(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}`)),
    getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/registrations`)),
    getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/players`)),
    getDocs(query(collection(db, 'players'), where('email', '>=', 'lifecycle.team'), where('email', '<=', 'lifecycle.team\uffff'))),
    getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/match_scores`)),
    getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/levels`)),
  ]);

  const registrationData = registrationSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const allRegistrationEmailsPresent = registrationData.every((registration) => {
    const playerOne = tournamentPlayersSnap.docs.find((playerDoc) => playerDoc.id === registration.playerId);
    const playerTwo = tournamentPlayersSnap.docs.find((playerDoc) => playerDoc.id === registration.partnerPlayerId);
    return Boolean(playerOne?.data().email) && Boolean(playerTwo?.data().email);
  });

  const completedLevelMatchCounts = await Promise.all(
    levelsSnap.docs.map(async (levelDoc) => {
      const levelScores = await getDocs(
        collection(db, `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/levels/${levelDoc.id}/match_scores`),
      );
      return levelScores.docs.filter((docSnap) => docSnap.data().status === 'completed').length;
    }),
  );

  return {
    orgId,
    orgName: (orgSnap.data()?.name as string) ?? ORG_NAME,
    orgSlug: (orgSnap.data()?.slug as string) ?? ORG_SLUG,
    orgLogoUrl: (orgSnap.data()?.logoUrl as string | null | undefined) ?? null,
    orgBannerUrl: (orgSnap.data()?.bannerUrl as string | null | undefined) ?? null,
    sponsorCount: Array.isArray(orgSnap.data()?.sponsors) ? (orgSnap.data()?.sponsors as unknown[]).length : 0,
    tournamentId: TOURNAMENT_ID,
    tournamentName: (tournamentSnap.data()?.name as string) ?? TOURNAMENT_NAME,
    tournamentStatus: tournamentSnap.data()?.status as string | undefined,
    tournamentState: tournamentSnap.data()?.state as string | undefined,
    categoryId: CATEGORY_ID,
    categoryName: (categorySnap.data()?.name as string) ?? CATEGORY_NAME,
    categoryStatus: categorySnap.data()?.status as string | undefined,
    registrationCount: registrationSnap.size,
    checkedInRegistrations: registrationData.filter((registration) => registration.status === 'checked_in').length,
    tournamentPlayerCount: tournamentPlayersSnap.size,
    globalPlayerCount: globalPlayersSnap.size,
    allRegistrationEmailsPresent,
    poolMatchCount: poolScoresSnap.size,
    completedPoolMatchCount: poolScoresSnap.docs.filter((docSnap) => docSnap.data().status === 'completed').length,
    levelCount: levelsSnap.size,
    completedLevelMatchCount: completedLevelMatchCounts.reduce((total, count) => total + count, 0),
  };
};

export const getLifecyclePlayerSnapshot = async (playerId: string): Promise<LifecyclePlayerSnapshot | null> => {
  const { db } = await getLifecycleSeedClients();
  const playerSnap = await getDoc(doc(db, 'players', playerId));

  if (!playerSnap.exists()) {
    return null;
  }

  const data = playerSnap.data();
  const doublesStats = (data.stats?.badminton?.doubles ?? {}) as {
    wins?: number;
    losses?: number;
    tournamentsPlayed?: number;
  };

  return {
    playerId,
    playerName: `${data.firstName as string} ${data.lastName as string}`,
    overallWins: (data.stats?.overall?.wins as number | undefined) ?? 0,
    overallLosses: (data.stats?.overall?.losses as number | undefined) ?? 0,
    tournamentsPlayed: (data.stats?.overall?.tournamentsPlayed as number | undefined) ?? 0,
    doublesWins: doublesStats.wins ?? 0,
    doublesLosses: doublesStats.losses ?? 0,
  };
};
