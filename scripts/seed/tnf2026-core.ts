/**
 * TNF 2026 Tournament Seed - Core Logic
 *
 * Reads the 2026 TNF registration workbook and seeds a tournament scaffold
 * with categories, courts, players, and approved registrations.
 */

import path from 'node:path';
import XLSX from 'xlsx';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { seedGlobalPlayer } from './helpers';

type PlayerGender = 'male' | 'female';

interface CategoryInfo {
  id: string;
  key: string;
  name: string;
}

interface RawParticipant {
  name: string;
  email: string;
  phone: string;
  city: string;
  level: string;
}

interface RawRegistration {
  categoryKey: string;
  participants: RawParticipant[];
  entryId: string;
}

interface ParsedRegistration {
  categoryKey: string;
  participants: SeedParticipant[];
  entryId: string;
}

interface SeedParticipant extends RawParticipant {
  seedEmail: string;
}

interface CategorySeedConfig {
  key: string;
  name: string;
  type: 'singles' | 'doubles' | 'mixed_doubles';
  gender: 'men' | 'women' | 'mixed' | 'open';
  selectColumn: number;
  dataStartColumn: number;
}

export interface TNF2026SeedConfig {
  db: Firestore;
  adminId: string;
  orgId?: string;
  organizerIds?: string[];
  tournamentName?: string;
  workbookPath?: string;
  startDateOffset?: number;
}

export const TNF_2026_ORG_NAME = 'Tamilnadu Foundation (TNF)';
export const TNF_2026_ORG_SLUG = 'tnf';
export const TNF_2026_TOURNAMENT_NAME = 'TNF Badminton - 2026';
export const TNF_2026_WORKBOOK_FILENAME = 'TNF_Final_List_2026.xlsx';

const CATEGORY_CONFIGS: readonly CategorySeedConfig[] = [
  {
    key: 'MS',
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    selectColumn: 4,
    dataStartColumn: 10,
  },
  {
    key: 'MD',
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    selectColumn: 5,
    dataStartColumn: 15,
  },
  {
    key: 'WD',
    name: "Women's Doubles",
    type: 'doubles',
    gender: 'women',
    selectColumn: 6,
    dataStartColumn: 25,
  },
  {
    key: 'MXD',
    name: 'Mixed Doubles',
    type: 'mixed_doubles',
    gender: 'mixed',
    selectColumn: 7,
    dataStartColumn: 35,
  },
  {
    key: 'YD',
    name: 'Youth Doubles',
    type: 'doubles',
    gender: 'open',
    selectColumn: 8,
    dataStartColumn: 45,
  },
  {
    key: 'KD',
    name: 'Kids Doubles',
    type: 'doubles',
    gender: 'open',
    selectColumn: 9,
    dataStartColumn: 55,
  },
] as const;

const cleanCell = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.)|(\.$)/g, '')
    .replace(/\.+/g, '.');

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
};

const toSkillLevel = (level: string): number => {
  const normalized = level.toLowerCase();
  if (normalized.includes('advanced')) return 8;
  if (normalized.includes('intermediate')) return 5;
  return 1;
};

const hasSelection = (row: unknown[], column: number): boolean => cleanCell(row[column]) !== '';

const readParticipant = (row: unknown[], startColumn: number): RawParticipant => ({
  name: cleanCell(row[startColumn]),
  email: cleanCell(row[startColumn + 1]),
  phone: cleanCell(row[startColumn + 2]),
  city: cleanCell(row[startColumn + 3]),
  level: cleanCell(row[startColumn + 4]),
});

const participantIdentityKey = (participant: SeedParticipant): string =>
  participant.seedEmail.toLowerCase();

const registrationIdentityKey = (registration: ParsedRegistration): string => {
  if (registration.participants.length === 1) {
    return `${registration.categoryKey}|${participantIdentityKey(registration.participants[0])}`;
  }

  const teamKey = registration.participants
    .map(participantIdentityKey)
    .sort()
    .join('|');

  return `${registration.categoryKey}|${teamKey}`;
};

const resolveSeedEmail = (
  participant: RawParticipant,
  emailNameMap: Map<string, Set<string>>,
): string => {
  const normalizedEmail = participant.email.toLowerCase();
  const normalizedName = participant.name.toLowerCase();
  const namesForEmail = normalizedEmail ? emailNameMap.get(normalizedEmail) : null;

  if (
    normalizedEmail &&
    namesForEmail &&
    namesForEmail.size === 1
  ) {
    return normalizedEmail;
  }

  const slug = slugify(participant.name || 'player');
  const discriminatorSource = normalizedEmail || participant.phone || participant.city || participant.level || 'seed';
  const discriminator = simpleHash(`${normalizedName}|${discriminatorSource.toLowerCase()}`);

  return `${slug}.${discriminator}@import.courtmastr.local`;
};

const extractRawRegistrations = (rows: unknown[][]): RawRegistration[] => {
  const registrations: RawRegistration[] = [];

  for (const row of rows) {
    const entryId = cleanCell(row[73]);

    if (hasSelection(row, 4)) {
      const singlesPrimary = readParticipant(row, 10);
      const singlesFallback = readParticipant(row, 15);
      const singlesParticipant = singlesPrimary.name ? singlesPrimary : singlesFallback;

      if (singlesParticipant.name) {
        registrations.push({
          categoryKey: 'MS',
          participants: [singlesParticipant],
          entryId,
        });
      }
    }

    for (const config of CATEGORY_CONFIGS) {
      if (config.key === 'MS' || !hasSelection(row, config.selectColumn)) {
        continue;
      }

      const playerOne = readParticipant(row, config.dataStartColumn);
      const playerTwo = readParticipant(row, config.dataStartColumn + 5);

      if (!playerOne.name || !playerTwo.name) {
        continue;
      }

      registrations.push({
        categoryKey: config.key,
        participants: [playerOne, playerTwo],
        entryId,
      });
    }
  }

  return registrations;
};

const parseWorkbook = (workbookPath: string): {
  registrations: ParsedRegistration[];
  duplicatesDropped: number;
} => {
  const workbook = XLSX.readFile(workbookPath);
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) {
    throw new Error('Workbook does not contain any sheets');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  }) as unknown[][];

  const rawRegistrations = extractRawRegistrations(rows.slice(1));
  const emailNameMap = new Map<string, Set<string>>();

  for (const registration of rawRegistrations) {
    for (const participant of registration.participants) {
      const normalizedEmail = participant.email.toLowerCase();
      if (!normalizedEmail) {
        continue;
      }

      const knownNames = emailNameMap.get(normalizedEmail) ?? new Set<string>();
      knownNames.add(participant.name.toLowerCase());
      emailNameMap.set(normalizedEmail, knownNames);
    }
  }

  const deduped = new Map<string, ParsedRegistration>();

  for (const registration of rawRegistrations) {
    const participants = registration.participants.map((participant) => ({
      ...participant,
      seedEmail: resolveSeedEmail(participant, emailNameMap),
    }));
    const parsedRegistration: ParsedRegistration = {
      categoryKey: registration.categoryKey,
      participants,
      entryId: registration.entryId,
    };
    const key = registrationIdentityKey(parsedRegistration);

    if (!deduped.has(key)) {
      deduped.set(key, parsedRegistration);
    }
  }

  return {
    registrations: [...deduped.values()],
    duplicatesDropped: rawRegistrations.length - deduped.size,
  };
};

const playerGenderForCategory = (
  categoryKey: string,
  participantIndex: number,
): PlayerGender => {
  if (categoryKey === 'WD') {
    return 'female';
  }

  if (categoryKey === 'MXD') {
    return participantIndex === 0 ? 'male' : 'female';
  }

  return 'male';
};

export async function runTNF2026Seed(config: TNF2026SeedConfig): Promise<string> {
  const { db, adminId, orgId } = config;
  const tournamentName = config.tournamentName ?? TNF_2026_TOURNAMENT_NAME;
  const startDateOffset = config.startDateOffset ?? 14;
  const workbookPath = config.workbookPath ?? path.resolve(process.cwd(), TNF_2026_WORKBOOK_FILENAME);
  const organizerIds = [...new Set([adminId, ...(config.organizerIds ?? [])])];

  const existingTournamentSnapshot = await getDocs(
    query(
      collection(db, 'tournaments'),
      where('name', '==', tournamentName),
      ...(orgId ? [where('orgId', '==', orgId)] : []),
    ),
  );

  if (!existingTournamentSnapshot.empty) {
    const existingDoc = existingTournamentSnapshot.docs[0];
    const existingId = existingDoc.id;
    const existingOrganizerIds = Array.isArray(existingDoc.data().organizerIds)
      ? (existingDoc.data().organizerIds as string[])
      : [];
    const mergedOrganizerIds = [...new Set([...existingOrganizerIds, ...organizerIds])];

    if (
      mergedOrganizerIds.length !== existingOrganizerIds.length ||
      (orgId && existingDoc.data().orgId !== orgId)
    ) {
      await updateDoc(existingDoc.ref, {
        organizerIds: mergedOrganizerIds,
        ...(orgId ? { orgId } : {}),
        updatedAt: serverTimestamp(),
      });
      console.log(`  Updated tournament access: ${existingId}`);
    }

    console.log(`  Found existing tournament: ${existingId}`);
    return existingId;
  }

  const parsedWorkbook = parseWorkbook(workbookPath);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startDateOffset);
  startDate.setHours(9, 0, 0, 0);

  console.log('\n[1] Creating Tournament...');
  const tournamentRef = await addDoc(collection(db, 'tournaments'), {
    name: tournamentName,
    description: 'TNF USA - Central Illinois Chapter badminton tournament',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'registration',
    state: 'REG_OPEN',
    location: 'Central Illinois',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 32 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 250,
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
    ...(orgId ? { orgId } : {}),
    createdBy: adminId,
    organizerIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const tournamentId = tournamentRef.id;
  console.log(`  Created tournament: ${tournamentId}`);

  console.log('\n[2] Creating Categories...');
  const categories: Record<string, CategoryInfo> = {};
  for (const configEntry of CATEGORY_CONFIGS) {
    const categoryRef = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
      tournamentId,
      name: configEntry.name,
      type: configEntry.type,
      gender: configEntry.gender,
      ageGroup: 'open',
      format: 'single_elimination',
      status: 'registration',
      seedingEnabled: true,
      maxParticipants: 64,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    categories[configEntry.key] = {
      id: categoryRef.id,
      key: configEntry.key,
      name: configEntry.name,
    };
    console.log(`  Created category: ${configEntry.name} (${categoryRef.id})`);
  }

  console.log('\n[3] Creating Courts...');
  for (let courtNumber = 1; courtNumber <= 5; courtNumber += 1) {
    await addDoc(collection(db, 'tournaments', tournamentId, 'courts'), {
      tournamentId,
      name: `Court ${courtNumber}`,
      number: courtNumber,
      status: 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log('  Created 5 courts');

  console.log('\n[4] Creating Players and Registrations...');
  const playerIdCache = new Map<string, string>();
  const emailIdCache = new Map<string, string>();
  const registrationCounts = new Map<string, number>();

  const getOrCreatePlayer = async (
    participant: SeedParticipant,
    gender: PlayerGender,
  ): Promise<string> => {
    const cacheKey = participant.seedEmail.toLowerCase();
    const cached = playerIdCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const nameParts = participant.name.split(' ').filter(Boolean);
    const firstName = nameParts.shift() ?? participant.name;
    const lastName = nameParts.join(' ') || '-';
    const globalPlayerId = await seedGlobalPlayer(
      db,
      tournamentId,
      {
        firstName,
        lastName,
        email: participant.seedEmail,
        phone: participant.phone || '555-0000',
        gender,
        skillLevel: toSkillLevel(participant.level),
      },
      emailIdCache,
    );

    playerIdCache.set(cacheKey, globalPlayerId);
    return globalPlayerId;
  };

  for (const registration of parsedWorkbook.registrations) {
    const category = categories[registration.categoryKey];
    if (!category) {
      throw new Error(`Missing category mapping for ${registration.categoryKey}`);
    }

    const playerOneId = await getOrCreatePlayer(
      registration.participants[0],
      playerGenderForCategory(registration.categoryKey, 0),
    );

    if (registration.participants.length === 1) {
      await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
        tournamentId,
        categoryId: category.id,
        participantType: 'player',
        playerId: playerOneId,
        status: 'approved',
        isCheckedIn: false,
        paymentStatus: 'paid',
        registeredBy: adminId,
        registeredAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: adminId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const playerTwoId = await getOrCreatePlayer(
        registration.participants[1],
        playerGenderForCategory(registration.categoryKey, 1),
      );
      const teamName = `${registration.participants[0].name} / ${registration.participants[1].name}`;

      await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
        tournamentId,
        categoryId: category.id,
        participantType: 'team',
        playerId: playerOneId,
        partnerPlayerId: playerTwoId,
        teamName,
        status: 'approved',
        isCheckedIn: false,
        paymentStatus: 'paid',
        registeredBy: adminId,
        registeredAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: adminId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    registrationCounts.set(
      registration.categoryKey,
      (registrationCounts.get(registration.categoryKey) ?? 0) + 1,
    );
  }

  console.log(`  Imported ${playerIdCache.size} unique players`);
  console.log(`  Imported ${parsedWorkbook.registrations.length} registrations`);
  console.log(`  Dropped ${parsedWorkbook.duplicatesDropped} duplicate registration rows`);

  for (const configEntry of CATEGORY_CONFIGS) {
    console.log(
      `  ${configEntry.name}: ${registrationCounts.get(configEntry.key) ?? 0} registrations`,
    );
  }

  return tournamentId;
}
