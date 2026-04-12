/**
 * Shared seed core: types, test-data constants, and all business logic.
 *
 * Both local.ts (emulator) and production.ts (real Firebase) import from here,
 * so they always exercise the EXACT same data and scenarios.
 *
 * Environment-specific concerns (Firebase init, auth) live in the callers.
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { seedGlobalPlayer } from './helpers';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '../../src/services/brackets-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryFormat = 'single_elimination' | 'double_elimination' | 'pool_to_elimination';
export type CategoryType = 'singles' | 'doubles' | 'mixed_doubles';
type SeedOrdering =
  | 'natural'
  | 'reverse'
  | 'half_shift'
  | 'reverse_half_shift'
  | 'pair_flip'
  | 'inner_outer'
  | 'groups.effort_balanced'
  | 'groups.seed_optimized'
  | 'groups.bracket_optimized';

export interface CategorySeedConfig {
  key: 'mens_singles' | 'mens_doubles' | 'mixed_doubles';
  name: string;
  type: CategoryType;
  gender: 'men' | 'mixed';
  format: CategoryFormat;
  participantCount: number;
}

export interface CategoryRef {
  id: string;
  config: CategorySeedConfig;
}

interface RegistrationSeed {
  id: string;
  seed: number | null;
  playerId?: string;
  partnerPlayerId?: string;
}

export interface SeedDataOptions {
  playerEmailDomain?: string;
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

// ─── Test-data constants ───────────────────────────────────────────────────────
// Edit here to change BOTH local and production simultaneously.

/**
 * Canonical 3 categories used for all testing.
 * Same categories → same scenarios → confidence when pushing to prod.
 */
export const CATEGORY_CONFIGS: CategorySeedConfig[] = [
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

// Deterministic stride: no randomness so names are always the same across runs
const NAME_STRIDE = 37;
// Players shared across categories (exercises multi-category registration edge cases)
const CROSS_CATEGORY_MALE_COUNT = 4;
const MIXED_SHARED_MALE_COUNT = 8;

// ─── Name helpers ─────────────────────────────────────────────────────────────

function buildRoster(firstNames: string[], count: number, startIndex: number): PlayerName[] {
  const totalUniqueNames = firstNames.length * LAST_NAMES.length;
  if (count > totalUniqueNames) {
    throw new Error(`Cannot generate ${count} unique names from ${totalUniqueNames} combinations`);
  }

  const roster: PlayerName[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i += 1) {
    let idx = (startIndex + i * NAME_STRIDE) % totalUniqueNames;
    while (usedIndices.has(idx)) {
      idx = (idx + 1) % totalUniqueNames;
    }
    usedIndices.add(idx);
    roster.push({
      first: firstNames[idx % firstNames.length],
      last: LAST_NAMES[Math.floor(idx / firstNames.length) % LAST_NAMES.length],
    });
  }
  return roster;
}

function formatFullName(player: PlayerName): string {
  return `${player.first} ${player.last}`;
}

function formatTeamName(p1: PlayerName, p2: PlayerName): string {
  return `${formatFullName(p1)} / ${formatFullName(p2)}`;
}

function toEmail(first: string, last: string, domain = 'seed.local'): string {
  const localPart = `${first}.${last}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${localPart}@${domain}`;
}

function toPhone(index: number): string {
  return `555-${String(1000 + index).slice(-4)}`;
}

// ─── Bracket helpers ───────────────────────────────────────────────────────────

function sortRegistrationsBySeed(registrations: RegistrationSeed[]): RegistrationSeed[] {
  const seeded = registrations
    .filter((r) => r.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));
  const unseeded = registrations
    .filter((r) => r.seed === null)
    .sort(() => Math.random() - 0.5);
  return [...seeded, ...unseeded];
}

function createSequentialSeeding(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

function createEliminationSeeding(count: number): (number | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(count, 2))));
  const seeding: (number | null)[] = createSequentialSeeding(count);
  while (seeding.length < bracketSize) seeding.push(null);
  return seeding;
}

function calculatePoolGroupCount(count: number): number {
  return Math.max(1, Math.ceil(count / 4));
}

// ─── Firestore writers ────────────────────────────────────────────────────────

export async function createTournament(db: Firestore, adminId: string, orgId?: string): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  const ref = await addDoc(collection(db, 'tournaments'), {
    name: 'Seed Tournament - Levels Ready',
    description: 'Seeded tournament for pool-to-elimination testing',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'Test Sports Complex',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 8 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 128,
    ...(orgId ? { orgId } : {}),
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
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('  Created tournament');
  return ref.id;
}

export async function createCourts(db: Firestore, tournamentId: string): Promise<void> {
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

export async function createCategories(db: Firestore, tournamentId: string): Promise<CategoryRef[]> {
  const refs: CategoryRef[] = [];

  for (const config of CATEGORY_CONFIGS) {
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
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
    refs.push({ id: ref.id, config });
    console.log(`  Created category: ${config.name} (${config.format})`);
  }

  return refs;
}

export async function createPlayersAndRegistrations(
  db: Firestore,
  tournamentId: string,
  adminId: string,
  categories: CategoryRef[],
  options: SeedDataOptions = {}
): Promise<Map<string, RegistrationSeed[]>> {
  const registrationByCategoryId = new Map<string, RegistrationSeed[]>();
  const playerIdByName = new Map<string, string>();
  const emailIdCache = new Map<string, string>();
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
    const globalPlayerId = await seedGlobalPlayer(db, tournamentId, {
      firstName: name.first,
      lastName: name.last,
      email: toEmail(name.first, name.last, options.playerEmailDomain),
      phone: toPhone(playerCounter),
      gender,
      skillLevel,
    }, emailIdCache);
    playerIdByName.set(key, globalPlayerId);
    return globalPlayerId;
  };

  const push = (categoryId: string, r: RegistrationSeed): void => {
    const list = registrationByCategoryId.get(categoryId) ?? [];
    list.push(r);
    registrationByCategoryId.set(categoryId, list);
  };

  const byKey = new Map(categories.map((c) => [c.config.key, c]));
  const singlesCategory = byKey.get('mens_singles');
  const doublesCategory = byKey.get('mens_doubles');
  const mixedCategory = byKey.get('mixed_doubles');

  if (!singlesCategory || !doublesCategory || !mixedCategory) {
    throw new Error('Missing one or more required categories');
  }

  // Build player pools (deterministic; some males appear in multiple categories)
  const singlesPlayers = buildRoster(MALE_FIRST_NAMES, singlesCategory.config.participantCount, 0);
  const crossMales = singlesPlayers.slice(0, CROSS_CATEGORY_MALE_COUNT);
  const doublesPlayers = [
    ...crossMales,
    ...buildRoster(MALE_FIRST_NAMES, doublesCategory.config.participantCount * 2 - crossMales.length, 240),
  ];
  const mixedSharedMales = singlesPlayers.slice(0, Math.min(MIXED_SHARED_MALE_COUNT, mixedCategory.config.participantCount));
  const mixedMales = [
    ...mixedSharedMales,
    ...buildRoster(MALE_FIRST_NAMES, mixedCategory.config.participantCount - mixedSharedMales.length, 480),
  ];
  const mixedFemales = buildRoster(FEMALE_FIRST_NAMES, mixedCategory.config.participantCount, 200);

  console.log('\n  Creating registrations...');

  // Men's Singles
  for (let i = 0; i < singlesPlayers.length; i += 1) {
    const name = singlesPlayers[i];
    const playerId = await getOrCreatePlayer(name, 'male', Math.max(1, 10 - (i % 10)));
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: singlesCategory.id,
      participantType: 'player',
      playerId,
      status: 'approved',
      seed: i + 1,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    push(singlesCategory.id, { id: ref.id, seed: i + 1 });
  }

  // Men's Doubles
  for (let i = 0; i < doublesCategory.config.participantCount; i += 1) {
    const p1 = doublesPlayers[i * 2];
    const p2 = doublesPlayers[i * 2 + 1];
    const playerId = await getOrCreatePlayer(p1, 'male', Math.max(1, 10 - (i % 10)));
    const partnerPlayerId = await getOrCreatePlayer(p2, 'male', Math.max(1, 10 - ((i + 3) % 10)));
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: doublesCategory.id,
      participantType: 'team',
      playerId,
      partnerPlayerId,
      teamName: formatTeamName(p1, p2),
      status: 'approved',
      seed: i + 1,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    push(doublesCategory.id, { id: ref.id, seed: i + 1, playerId, partnerPlayerId });
  }

  // Mixed Doubles
  for (let i = 0; i < mixedCategory.config.participantCount; i += 1) {
    const male = mixedMales[i];
    const female = mixedFemales[i];
    const playerId = await getOrCreatePlayer(male, 'male', Math.max(1, 10 - (i % 10)));
    const partnerPlayerId = await getOrCreatePlayer(female, 'female', Math.max(1, 10 - ((i + 2) % 10)));
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId: mixedCategory.id,
      participantType: 'team',
      playerId,
      partnerPlayerId,
      teamName: formatTeamName(male, female),
      status: 'approved',
      seed: i + 1,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    push(mixedCategory.id, { id: ref.id, seed: i + 1 });
  }

  console.log(`  Total unique players created: ${playerIdByName.size}`);
  console.log(`  Cross-category males (singles + doubles): ${crossMales.length}`);
  console.log(`  Cross-category males (singles + mixed):   ${mixedSharedMales.length}`);
  return registrationByCategoryId;
}

async function clearCategoryBracketData(db: Firestore, tournamentId: string, categoryId: string): Promise<void> {
  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${categoryId}`);
  for (const table of ['match', 'match_game', 'round', 'group', 'stage', 'participant'] as const) {
    await storage.delete(table);
  }
}

export async function generateCategoryBracket(
  db: Firestore,
  tournamentId: string,
  category: CategoryRef,
  registrations: RegistrationSeed[]
): Promise<number> {
  if (registrations.length < 2) {
    throw new Error(`Need at least 2 registrations for ${category.config.name}`);
  }

  await clearCategoryBracketData(db, tournamentId, category.id);

  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${category.id}`);
  const manager = new BracketsManager(storage);

  const sorted = sortRegistrationsBySeed(registrations);
  const participants = sorted.map((r, i) => ({ id: i + 1, tournament_id: category.id, name: r.id }));
  await storage.insert('participant', participants);

  let stageType: 'single_elimination' | 'double_elimination' | 'round_robin';
  let seedingIds: (number | null)[];
  const settings: { seedOrdering?: SeedOrdering[]; groupCount?: number; grandFinal?: 'simple' | 'double' | 'none' } = {};

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
  if (!Number.isFinite(stageId)) throw new Error(`Failed to resolve stage id for ${category.config.name}`);

  if (category.config.format === 'pool_to_elimination') {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', category.id),
      {
        status: 'active', stageId, poolStageId: stageId, eliminationStageId: null,
        poolPhase: 'pool', poolGroupCount: settings.groupCount ?? null,
        poolQualifiersPerGroup: 2, poolQualifiedRegistrationIds: [],
        bracketGeneratedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', category.id),
      {
        status: 'active', stageId, poolStageId: null, eliminationStageId: null,
        poolPhase: null, poolGroupCount: null, poolQualifiersPerGroup: null,
        poolQualifiedRegistrationIds: [], bracketGeneratedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return stageId;
}

export async function completePoolMatches(
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  poolStageId: number,
  registrationSeeds: RegistrationSeed[]
): Promise<{ completed: number; globalStats: Map<string, { wins: number; losses: number }> }> {
  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${categoryId}`);
  const matchesRaw = await storage.select<StoredMatch>('match', { stage_id: poolStageId });
  const participantsRaw = await storage.select<StoredParticipant>('participant');

  const matches = Array.isArray(matchesRaw) ? matchesRaw : matchesRaw ? [matchesRaw] : [];
  const participants = Array.isArray(participantsRaw) ? participantsRaw : participantsRaw ? [participantsRaw] : [];

  const regIdByParticipantId = new Map<number, string>(
    participants.map((p) => [Number(p.id), String(p.name)])
  );
  const seedByRegId = new Map<string, number>(
    registrationSeeds
      .filter((r): r is { id: string; seed: number; playerId?: string; partnerPlayerId?: string } => r.seed !== null)
      .map((r) => [r.id, r.seed])
  );
  const playersByRegId = new Map<string, { playerId: string; partnerPlayerId?: string }>(
    registrationSeeds
      .filter((r): r is RegistrationSeed & { playerId: string } => !!r.playerId)
      .map((r) => [r.id, { playerId: r.playerId!, partnerPlayerId: r.partnerPlayerId }])
  );

  const globalStats = new Map<string, { wins: number; losses: number }>();
  const trackStat = (globalId: string, won: boolean): void => {
    const s = globalStats.get(globalId) ?? { wins: 0, losses: 0 };
    if (won) s.wins += 1; else s.losses += 1;
    globalStats.set(globalId, s);
  };

  let completed = 0;

  for (const match of matches) {
    const p1 = match.opponent1?.id != null ? Number(match.opponent1.id) : null;
    const p2 = match.opponent2?.id != null ? Number(match.opponent2.id) : null;
    if (p1 === null || p2 === null) continue;

    const reg1 = regIdByParticipantId.get(p1);
    const reg2 = regIdByParticipantId.get(p2);
    if (!reg1 || !reg2) continue;

    const seed1 = seedByRegId.get(reg1) ?? Number.MAX_SAFE_INTEGER;
    const seed2 = seedByRegId.get(reg2) ?? Number.MAX_SAFE_INTEGER;
    const winnerIsP1 = seed1 <= seed2;
    const winnerId = winnerIsP1 ? reg1 : reg2;
    const loserScore = 12 + (completed % 8);
    const matchId = String(match.id);

    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId),
      {
        tournamentId,
        status: 'completed', winnerId,
        participant1Id: reg1,
        participant2Id: reg2,
        scores: [{
          gameNumber: 1,
          score1: winnerIsP1 ? 21 : loserScore,
          score2: winnerIsP1 ? loserScore : 21,
          winnerId,
          isComplete: true,
        }],
        completedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match', matchId),
      {
        status: 4,
        opponent1: { ...(match.opponent1 || {}), result: winnerIsP1 ? 'win' : 'loss' },
        opponent2: { ...(match.opponent2 || {}), result: winnerIsP1 ? 'loss' : 'win' },
      },
      { merge: true }
    );

    // Accumulate wins/losses per globalPlayerId (both primary and partner)
    const info1 = playersByRegId.get(reg1);
    const info2 = playersByRegId.get(reg2);
    if (info1) {
      trackStat(info1.playerId, winnerIsP1);
      if (info1.partnerPlayerId) trackStat(info1.partnerPlayerId, winnerIsP1);
    }
    if (info2) {
      trackStat(info2.playerId, !winnerIsP1);
      if (info2.partnerPlayerId) trackStat(info2.partnerPlayerId, !winnerIsP1);
    }

    completed += 1;
  }

  await setDoc(
    doc(db, 'tournaments', tournamentId, 'categories', categoryId),
    { poolCompletedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );

  return { completed, globalStats };
}

// ─── Main orchestration (env-agnostic) ────────────────────────────────────────

export async function runSeed(db: Firestore, adminId: string, orgId?: string): Promise<void> {
  console.log('\n[2] Creating tournament...');
  const tournamentId = await createTournament(db, adminId, orgId);

  console.log('\n[3] Creating courts...');
  await createCourts(db, tournamentId);

  console.log('\n[4] Creating categories...');
  const categories = await createCategories(db, tournamentId);

  console.log('\n[5] Creating players and registrations...');
  const registrationsByCategory = await createPlayersAndRegistrations(db, tournamentId, adminId, categories);

  console.log('\n[6] Generating brackets for all categories...');
  let doublesStageId: number | null = null;
  let doublesCategoryId: string | null = null;

  for (const category of categories) {
    const registrations = registrationsByCategory.get(category.id) ?? [];
    const stageId = await generateCategoryBracket(db, tournamentId, category, registrations);
    console.log(`  Bracket generated: ${category.config.name} (stage ${stageId})`);
    if (category.config.key === 'mens_doubles') {
      doublesStageId = stageId;
      doublesCategoryId = category.id;
    }
  }

  console.log("\n[7] Completing all Men's Doubles pool matches...");
  if (!doublesCategoryId || doublesStageId === null) throw new Error("Men's Doubles pool stage not found");

  const { completed: completedCount, globalStats } = await completePoolMatches(
    db,
    tournamentId,
    doublesCategoryId,
    doublesStageId,
    registrationsByCategory.get(doublesCategoryId) ?? []
  );
  console.log(`  Completed ${completedCount} pool matches`);

  console.log('\n[8] Seeding GlobalPlayer match stats...');
  for (const [globalPlayerId, stats] of globalStats) {
    await setDoc(
      doc(db, 'players', globalPlayerId),
      {
        stats: {
          overall: {
            wins: stats.wins,
            losses: stats.losses,
            gamesPlayed: stats.wins + stats.losses,
            tournamentsPlayed: 1,
          },
          badminton: {
            doubles: {
              wins: stats.wins,
              losses: stats.losses,
              gamesPlayed: stats.wins + stats.losses,
              tournamentsPlayed: 1,
            },
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  console.log(`  Updated stats for ${globalStats.size} players`);

  console.log('\n' + '='.repeat(64));
  console.log('  Seed completed successfully');
  console.log('='.repeat(64));
  console.log(`\n  Tournament ID: ${tournamentId}`);
  console.log("    - Men's Singles:  single_elimination  (15 players)");
  console.log("    - Men's Doubles:  pool_to_elimination (23 teams, pool pre-completed)");
  console.log("    - Mixed Doubles:  double_elimination  (13 teams)");
  console.log('  Login: admin@courtmastr.com / admin123');
  console.log("\n  Next step for Men's Doubles: Open dashboard → Create Levels.");
  console.log('');
}
