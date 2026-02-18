/**
 * Simple Tournament Seed Script (Emulator)
 *
 * Creates one tournament with:
 * - Men's Singles (single elimination)
 * - Men's Doubles (pool-to-elimination)
 * - Mixed Doubles (double elimination)
 *
 * Also:
 * - Generates brackets for all 3 categories
 * - Completes all Men's Doubles pool matches (with scores) so admin can move to next phase
 *
 * Run with: npm run seed:simple
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '../src/services/brackets-storage';

type CategoryFormat = 'single_elimination' | 'double_elimination' | 'pool_to_elimination';
type CategoryType = 'singles' | 'doubles' | 'mixed_doubles';

interface CategorySeedConfig {
  key: 'mens_singles' | 'mens_doubles' | 'mixed_doubles';
  name: string;
  type: CategoryType;
  gender: 'men' | 'mixed';
  format: CategoryFormat;
  participantCount: number;
}

interface CategoryRef {
  id: string;
  config: CategorySeedConfig;
}

interface RegistrationSeed {
  id: string;
  seed: number | null;
}

interface PlayerName {
  first: string;
  last: string;
}

interface StoredParticipant {
  id: number;
  name: string; // registrationId
}

interface StoredOpponent {
  id: number | string | null;
  result?: 'win' | 'loss' | 'draw';
}

interface StoredMatch {
  id: number | string;
  stage_id: number | string;
  opponent1?: StoredOpponent | null;
  opponent2?: StoredOpponent | null;
}

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);

const CATEGORY_CONFIGS: CategorySeedConfig[] = [
  {
    key: 'mens_singles',
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    format: 'single_elimination',
    participantCount: 15,
  },
  {
    key: 'mens_doubles',
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    format: 'pool_to_elimination',
    participantCount: 23,
  },
  {
    key: 'mixed_doubles',
    name: 'Mixed Doubles',
    type: 'mixed_doubles',
    gender: 'mixed',
    format: 'double_elimination',
    participantCount: 13,
  },
];

const MALE_FIRST_NAMES = [
  'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel',
  'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin',
  'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
  'Nicholas', 'Eric', 'Stephen', 'Jonathan', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
];

const FEMALE_FIRST_NAMES = [
  'Emma', 'Olivia', 'Sophia', 'Ava', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  'Abigail', 'Emily', 'Elizabeth', 'Avery', 'Sofia', 'Ella', 'Madison', 'Scarlett', 'Victoria', 'Aria',
];

const LAST_NAMES = [
  'Anderson', 'Baker', 'Carter', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris', 'Irving', 'Jones',
  'King', 'Lopez', 'Martin', 'Nelson', 'Oliver', 'Parker', 'Quinn', 'Roberts', 'Smith', 'Taylor',
  'Usman', 'Vargas', 'Walker', 'Xu', 'Young', 'Zimmerman', 'Clark', 'Miller', 'Moore', 'Jackson',
  'White', 'Thompson', 'Lewis', 'Hall', 'Allen', 'Wright', 'Torres', 'Nguyen', 'Green', 'Rivera',
];

const NAME_STRIDE = 37;
const CROSS_CATEGORY_MALE_COUNT = 4;
const MIXED_SHARED_MALE_COUNT = 8;

function buildRoster(firstNames: string[], count: number, startIndex: number): PlayerName[] {
  const totalUniqueNames = firstNames.length * LAST_NAMES.length;
  if (count > totalUniqueNames) {
    throw new Error(`Cannot generate ${count} unique names from available first/last combinations`);
  }

  const roster: PlayerName[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i += 1) {
    let idx = (startIndex + i * NAME_STRIDE) % totalUniqueNames;
    while (usedIndices.has(idx)) {
      idx = (idx + 1) % totalUniqueNames;
    }
    usedIndices.add(idx);

    const first = firstNames[idx % firstNames.length];
    const last = LAST_NAMES[Math.floor(idx / firstNames.length) % LAST_NAMES.length];
    roster.push({ first, last });
  }
  return roster;
}

function formatFullName(player: PlayerName): string {
  return `${player.first} ${player.last}`;
}

function formatTeamName(playerOne: PlayerName, playerTwo: PlayerName): string {
  return `${formatFullName(playerOne)} / ${formatFullName(playerTwo)}`;
}

function toEmail(first: string, last: string): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}@seed.local`;
}

function toPhone(index: number): string {
  return `555-${String(1000 + index).slice(-4)}`;
}

function sortRegistrationsBySeed(registrations: RegistrationSeed[]): RegistrationSeed[] {
  const seeded = registrations
    .filter((registration) => registration.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));

  const unseeded = registrations
    .filter((registration) => registration.seed === null)
    .sort(() => Math.random() - 0.5);

  return [...seeded, ...unseeded];
}

function createSequentialSeeding(participantCount: number): number[] {
  return Array.from({ length: participantCount }, (_, index) => index + 1);
}

function createEliminationSeeding(participantCount: number): (number | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantCount, 2))));
  const seeding: (number | null)[] = createSequentialSeeding(participantCount);
  while (seeding.length < bracketSize) {
    seeding.push(null);
  }
  return seeding;
}

function calculatePoolGroupCount(participantCount: number): number {
  return Math.max(1, Math.ceil(participantCount / 4));
}

async function createOrSignInAdmin(): Promise<string> {
  const email = 'admin@courtmaster.local';
  const password = 'admin123';

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', user.uid), {
      email,
      displayName: 'Tournament Admin',
      role: 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('  Created admin user');
    return user.uid;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'auth/email-already-in-use') {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email,
          displayName: 'Tournament Admin',
          role: 'admin',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('  Signed in as admin');
      return user.uid;
    }
    throw error;
  }
}

async function createTournament(adminId: string): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  const tournamentRef = await addDoc(collection(db, 'tournaments'), {
    name: 'Seed Tournament - Levels Ready',
    description: "Seeded tournament for pool-to-elimination testing",
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'Emulator Sports Complex',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 8 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 128,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 20,
      allowSelfRegistration: false,
      requireApproval: false,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('  Created tournament');
  return tournamentRef.id;
}

async function createCourts(tournamentId: string): Promise<void> {
  for (let i = 1; i <= 6; i += 1) {
    await addDoc(collection(db, 'tournaments', tournamentId, 'courts'), {
      tournamentId,
      name: `Court ${i}`,
      number: i,
      status: 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log('  Created 6 courts');
}

async function createCategories(tournamentId: string): Promise<CategoryRef[]> {
  const categoryRefs: CategoryRef[] = [];

  for (const config of CATEGORY_CONFIGS) {
    const categoryRef = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
      tournamentId,
      name: config.name,
      type: config.type,
      gender: config.gender,
      ageGroup: 'open',
      format: config.format,
      status: 'setup',
      seedingEnabled: true,
      maxParticipants: config.participantCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    categoryRefs.push({ id: categoryRef.id, config });
    console.log(`  Created category: ${config.name} (${config.format})`);
  }

  return categoryRefs;
}

async function createPlayersAndRegistrations(
  tournamentId: string,
  adminId: string,
  categories: CategoryRef[]
): Promise<Map<string, RegistrationSeed[]>> {
  const registrationByCategoryId = new Map<string, RegistrationSeed[]>();
  const playerIdByName = new Map<string, string>();
  let playerCounter = 0;

  const getOrCreatePlayer = async (
    name: PlayerName,
    gender: 'male' | 'female',
    skillLevel: number
  ): Promise<string> => {
    const key = `${name.first}-${name.last}`;
    const existing = playerIdByName.get(key);
    if (existing) return existing;

    playerCounter += 1;
    const playerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), {
      firstName: name.first,
      lastName: name.last,
      email: toEmail(name.first, name.last),
      phone: toPhone(playerCounter),
      gender,
      skillLevel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    playerIdByName.set(key, playerRef.id);
    return playerRef.id;
  };

  const pushRegistration = (categoryId: string, registration: RegistrationSeed): void => {
    const existing = registrationByCategoryId.get(categoryId) || [];
    existing.push(registration);
    registrationByCategoryId.set(categoryId, existing);
  };

  const byKey = new Map(categories.map((category) => [category.config.key, category]));
  const singlesCategory = byKey.get('mens_singles');
  const menDoublesCategory = byKey.get('mens_doubles');
  const mixedDoublesCategory = byKey.get('mixed_doubles');

  if (!singlesCategory || !menDoublesCategory || !mixedDoublesCategory) {
    throw new Error('Missing one or more required categories');
  }

  const singlesPlayers = buildRoster(MALE_FIRST_NAMES, singlesCategory.config.participantCount, 0);
  const crossCategoryMales = singlesPlayers.slice(0, CROSS_CATEGORY_MALE_COUNT);
  const menDoublesPlayers = [
    ...crossCategoryMales,
    ...buildRoster(
      MALE_FIRST_NAMES,
      menDoublesCategory.config.participantCount * 2 - crossCategoryMales.length,
      240
    ),
  ];
  const mixedSharedMales = singlesPlayers.slice(
    0,
    Math.min(MIXED_SHARED_MALE_COUNT, mixedDoublesCategory.config.participantCount)
  );
  const mixedDoublesMales = [
    ...mixedSharedMales,
    ...buildRoster(
      MALE_FIRST_NAMES,
      mixedDoublesCategory.config.participantCount - mixedSharedMales.length,
      480
    ),
  ];
  const mixedDoublesFemales = buildRoster(FEMALE_FIRST_NAMES, mixedDoublesCategory.config.participantCount, 200);

  console.log('\n  Creating registrations...');

  for (let i = 0; i < singlesPlayers.length; i += 1) {
    const playerName = singlesPlayers[i];
    const playerId = await getOrCreatePlayer(playerName, 'male', Math.max(1, 10 - (i % 10)));
    const seed = i + 1;

    const registrationRef = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: singlesCategory.id,
      participantType: 'player',
      playerId,
      status: 'approved',
      seed,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    pushRegistration(singlesCategory.id, { id: registrationRef.id, seed });
  }

  for (let i = 0; i < menDoublesCategory.config.participantCount; i += 1) {
    const p1 = menDoublesPlayers[i * 2];
    const p2 = menDoublesPlayers[i * 2 + 1];
    const playerId = await getOrCreatePlayer(p1, 'male', Math.max(1, 10 - (i % 10)));
    const partnerPlayerId = await getOrCreatePlayer(p2, 'male', Math.max(1, 10 - ((i + 3) % 10)));
    const seed = i + 1;

    const registrationRef = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: menDoublesCategory.id,
      participantType: 'team',
      playerId,
      partnerPlayerId,
      teamName: formatTeamName(p1, p2),
      status: 'approved',
      seed,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    pushRegistration(menDoublesCategory.id, { id: registrationRef.id, seed });
  }

  for (let i = 0; i < mixedDoublesCategory.config.participantCount; i += 1) {
    const male = mixedDoublesMales[i];
    const female = mixedDoublesFemales[i];
    const playerId = await getOrCreatePlayer(male, 'male', Math.max(1, 10 - (i % 10)));
    const partnerPlayerId = await getOrCreatePlayer(female, 'female', Math.max(1, 10 - ((i + 2) % 10)));
    const seed = i + 1;

    const registrationRef = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: mixedDoublesCategory.id,
      participantType: 'team',
      playerId,
      partnerPlayerId,
      teamName: formatTeamName(male, female),
      status: 'approved',
      seed,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    pushRegistration(mixedDoublesCategory.id, { id: registrationRef.id, seed });
  }

  console.log(`  Total unique players created: ${playerIdByName.size}`);
  console.log(`  Shared men across all 3 categories: ${crossCategoryMales.length}`);
  return registrationByCategoryId;
}

async function clearCategoryBracketData(tournamentId: string, categoryId: string): Promise<void> {
  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${categoryId}`);
  await storage.delete('match');
  await storage.delete('match_game');
  await storage.delete('round');
  await storage.delete('group');
  await storage.delete('stage');
  await storage.delete('participant');
}

async function generateCategoryBracket(
  tournamentId: string,
  category: CategoryRef,
  registrations: RegistrationSeed[]
): Promise<number> {
  if (registrations.length < 2) {
    throw new Error(`Need at least 2 registrations for ${category.config.name}`);
  }

  await clearCategoryBracketData(tournamentId, category.id);

  const categoryPath = `tournaments/${tournamentId}/categories/${category.id}`;
  const storage = new ClientFirestoreStorage(db, categoryPath);
  const manager = new BracketsManager(storage);

  const sortedRegistrations = sortRegistrationsBySeed(registrations);
  const participants = sortedRegistrations.map((registration, index) => ({
    id: index + 1,
    tournament_id: category.id,
    name: registration.id,
  }));
  await storage.insert('participant', participants);

  let stageType: 'single_elimination' | 'double_elimination' | 'round_robin';
  let seedingIds: (number | null)[];
  const settings: {
    seedOrdering?: string[];
    groupCount?: number;
    grandFinal?: 'simple' | 'double' | 'none';
  } = {};

  if (category.config.format === 'pool_to_elimination') {
    stageType = 'round_robin';
    seedingIds = createSequentialSeeding(participants.length);
    settings.seedOrdering = ['groups.effort_balanced'];
    settings.groupCount = calculatePoolGroupCount(participants.length);
  } else if (category.config.format === 'double_elimination') {
    stageType = 'double_elimination';
    seedingIds = createEliminationSeeding(participants.length);
    settings.seedOrdering = ['inner_outer'];
    settings.grandFinal = 'double';
  } else {
    stageType = 'single_elimination';
    seedingIds = createEliminationSeeding(participants.length);
    settings.seedOrdering = ['inner_outer'];
  }

  const stage = await manager.create.stage({
    tournamentId: category.id,
    name: category.config.format === 'pool_to_elimination'
      ? `${category.config.name} - Pool Play`
      : category.config.name,
    type: stageType,
    seedingIds,
    settings,
  });

  const stageId = Number((stage as { id?: number | string }).id);
  if (!Number.isFinite(stageId)) {
    throw new Error(`Failed to resolve stage id for ${category.config.name}`);
  }

  if (category.config.format === 'pool_to_elimination') {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', category.id),
      {
        status: 'active',
        stageId,
        poolStageId: stageId,
        eliminationStageId: null,
        poolPhase: 'pool',
        poolGroupCount: settings.groupCount || null,
        poolQualifiersPerGroup: 2,
        poolQualifiedRegistrationIds: [],
        bracketGeneratedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', category.id),
      {
        status: 'active',
        stageId,
        poolStageId: null,
        eliminationStageId: null,
        poolPhase: null,
        poolGroupCount: null,
        poolQualifiersPerGroup: null,
        poolQualifiedRegistrationIds: [],
        bracketGeneratedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return stageId;
}

async function completePoolMatches(
  tournamentId: string,
  categoryId: string,
  poolStageId: number,
  registrationSeeds: RegistrationSeed[]
): Promise<number> {
  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${categoryId}`);
  const matchesRaw = await storage.select<StoredMatch>('match', { stage_id: poolStageId });
  const participantsRaw = await storage.select<StoredParticipant>('participant');

  const matches = Array.isArray(matchesRaw) ? matchesRaw : matchesRaw ? [matchesRaw] : [];
  const participants = Array.isArray(participantsRaw) ? participantsRaw : participantsRaw ? [participantsRaw] : [];

  const registrationIdByParticipantId = new Map<number, string>(
    participants.map((participant) => [Number(participant.id), String(participant.name)])
  );
  const seedByRegistrationId = new Map<string, number>(
    registrationSeeds
      .filter((registration): registration is { id: string; seed: number } => registration.seed !== null)
      .map((registration) => [registration.id, registration.seed])
  );

  let completed = 0;

  for (const match of matches) {
    const p1 = match.opponent1?.id !== null && match.opponent1?.id !== undefined
      ? Number(match.opponent1.id)
      : null;
    const p2 = match.opponent2?.id !== null && match.opponent2?.id !== undefined
      ? Number(match.opponent2.id)
      : null;

    if (p1 === null || p2 === null) continue;

    const reg1 = registrationIdByParticipantId.get(p1);
    const reg2 = registrationIdByParticipantId.get(p2);
    if (!reg1 || !reg2) continue;

    const seed1 = seedByRegistrationId.get(reg1) ?? Number.MAX_SAFE_INTEGER;
    const seed2 = seedByRegistrationId.get(reg2) ?? Number.MAX_SAFE_INTEGER;
    const winnerId = seed1 <= seed2 ? reg1 : reg2;
    const winnerIsP1 = winnerId === reg1;
    const loserScore = 12 + (completed % 8);
    const score1 = winnerIsP1 ? 21 : loserScore;
    const score2 = winnerIsP1 ? loserScore : 21;
    const matchId = String(match.id);

    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId),
      {
        status: 'completed',
        winnerId,
        scores: [
          {
            gameNumber: 1,
            score1,
            score2,
            winnerId,
            isComplete: true,
          },
        ],
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match', matchId),
      {
        status: 4,
        opponent1: {
          ...(match.opponent1 || {}),
          result: winnerIsP1 ? 'win' : 'loss',
        },
        opponent2: {
          ...(match.opponent2 || {}),
          result: winnerIsP1 ? 'loss' : 'win',
        },
      },
      { merge: true }
    );

    completed += 1;
  }

  await setDoc(
    doc(db, 'tournaments', tournamentId, 'categories', categoryId),
    {
      poolCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return completed;
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(64));
  console.log('  Simple Seed: Singles + Doubles + Pool Ready');
  console.log('='.repeat(64));

  try {
    console.log('\n[1/8] Setting up admin user...');
    const adminId = await createOrSignInAdmin();

    console.log('\n[2/8] Creating tournament...');
    const tournamentId = await createTournament(adminId);

    console.log('\n[3/8] Creating courts...');
    await createCourts(tournamentId);

    console.log('\n[4/8] Creating categories...');
    const categories = await createCategories(tournamentId);

    console.log('\n[5/8] Creating players and registrations...');
    const registrationsByCategory = await createPlayersAndRegistrations(tournamentId, adminId, categories);

    console.log('\n[6/8] Generating brackets for all categories...');
    let mensDoublesStageId: number | null = null;
    let mensDoublesCategoryId: string | null = null;
    for (const category of categories) {
      const registrations = registrationsByCategory.get(category.id) || [];
      const stageId = await generateCategoryBracket(tournamentId, category, registrations);
      console.log(`  Bracket generated: ${category.config.name} (stage ${stageId})`);

      if (category.config.key === 'mens_doubles') {
        mensDoublesStageId = stageId;
        mensDoublesCategoryId = category.id;
      }
    }

    console.log('\n[7/8] Completing all Men\'s Doubles pool matches...');
    if (!mensDoublesCategoryId || mensDoublesStageId === null) {
      throw new Error("Men's Doubles pool stage not found");
    }

    const completedMatches = await completePoolMatches(
      tournamentId,
      mensDoublesCategoryId,
      mensDoublesStageId,
      registrationsByCategory.get(mensDoublesCategoryId) || []
    );
    console.log(`  Completed ${completedMatches} pool matches`);

    console.log('\n[8/8] Final summary...');
    console.log('\n' + '='.repeat(64));
    console.log('  Seed completed successfully');
    console.log('='.repeat(64));
    console.log(`\n  Tournament ID: ${tournamentId}`);
    console.log('  Categories:');
    console.log('    - Men\'s Singles: single elimination (15 players)');
    console.log('    - Men\'s Doubles: pool_to_elimination (23 teams, pool matches completed)');
    console.log('    - Mixed Doubles: double elimination (13 teams)');
    console.log('  Login: admin@courtmaster.local / admin123');
    console.log('\n  Next step in UI for Men\'s Doubles:');
    console.log('    Open dashboard -> Create Levels (pool results are ready).');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
