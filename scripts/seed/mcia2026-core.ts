/**
 * MCIA 2026 Tournament Seed - Core Logic
 *
 * Emulator-first seeding logic for:
 * - Tournament: MCIA Badminton 2026
 * - Category: Men's Doubles (pool_to_elimination)
 *
 * This script creates players + team registrations only.
 * Pool/bracket generation and scheduling are handled in the UI.
 */

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';

interface MCIA2026SeedConfig {
  db: Firestore;
  adminId: string;
  tournamentName?: string;
  startDateOffset?: number;
}

type GroupKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

interface TeamPair {
  player1: string;
  player2: string;
  teamName: string;
}

interface SeededTeam extends TeamPair {
  seed: number;
  group: GroupKey;
  slot: number;
}

const GROUP_ORDER: GroupKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const MCIA_MENS_DOUBLES_GROUPS: Record<GroupKey, readonly string[]> = {
  A: [
    'Christuraj & Abhiram Madugula',
    'Kishore Subbarao & Ramc Venkatasamy',
    'Sakthi & Sahaya Vinodh',
    'Sivakumar Srinivasulu & Vijaysivakumar Moorthy',
  ],
  B: [
    'Sai kiran Chekuri & Prakash Mukku',
    'Gowtham Kandasamy & Arjun Ponnapati',
    'Sakthivel Shanmugam & Sakthinesan',
    'Shakthi Rajendran & Nirmal Anandam',
  ],
  C: [
    'Sudhan Sekar & Dhrumil Trivedj',
    'Ranjith Vijayasekar & Vinothkumar Nagarajan',
    'Mathibal Balasubramanian & Srikanth Marikkannu',
    'Dinesh Krishnan & Siva shankar Raghunathan',
  ],
  D: [
    'Aamir Abdullah & Rajesh Panicker',
    'Karthik Kalairajan & Manoj Edward',
    'Arjun Chinamgari & Himesh Reddivari',
    'Kothandaraman Narasiman & Jawaharbabu Jayaram',
  ],
  E: [
    'Mohan Krishnan & Rahul Yadav Gopalakrishnan',
    'Sriraman Balakrishnan & Kumaran Thirunavukkarasu',
    'Adinarayana Botlagunta & Ravi Bhushan Mishra',
    'Arun Kumar Jayagopal & Karthikeyan S',
  ],
  F: [
    'Raja Kakani & Amit Vyas',
    'Hemchandran Manivannan & Anand Seenivasan',
    'Rohith Kariveda & Venkatesh Prabhu',
    'Satheeshkumar Kannan & Naveenkumar Pari',
  ],
  G: [
    'Vinay Patnaik & Vishnu',
    'Prem & Raj',
    'Mahesh & Sudheer',
    'Aakash Paranjape & Subhash Varikuti',
  ],
} as const;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const normalized = normalizeName(fullName);
  const tokens = normalized.split(' ');
  const firstName = tokens.shift() || normalized;
  const lastName = tokens.join(' ') || '-';
  return { firstName, lastName };
}

function parseTeam(rawTeamName: string): TeamPair {
  const normalized = normalizeName(rawTeamName);
  const parts = normalized.split(/\s*&\s*/);
  if (parts.length !== 2) {
    throw new Error(`Invalid team format: "${rawTeamName}"`);
  }

  const player1 = normalizeName(parts[0]);
  const player2 = normalizeName(parts[1]);

  if (!player1 || !player2) {
    throw new Error(`Invalid team members in: "${rawTeamName}"`);
  }

  return {
    player1,
    player2,
    teamName: `${player1} & ${player2}`,
  };
}

function buildSeededTeams(): SeededTeam[] {
  const expectedGroups = GROUP_ORDER.length;
  if (Object.keys(MCIA_MENS_DOUBLES_GROUPS).length !== expectedGroups) {
    throw new Error(`Expected ${expectedGroups} groups in MCIA dataset`);
  }

  const seeded: SeededTeam[] = [];
  const seenTeamNames = new Set<string>();

  for (let slot = 0; slot < 4; slot += 1) {
    for (const group of GROUP_ORDER) {
      const teams = MCIA_MENS_DOUBLES_GROUPS[group];
      if (teams.length !== 4) {
        throw new Error(`Group ${group} must contain exactly 4 teams`);
      }

      const rawTeam = teams[slot];
      const parsed = parseTeam(rawTeam);

      if (seenTeamNames.has(parsed.teamName.toLowerCase())) {
        throw new Error(`Duplicate team detected: ${parsed.teamName}`);
      }
      seenTeamNames.add(parsed.teamName.toLowerCase());

      seeded.push({
        ...parsed,
        seed: seeded.length + 1,
        group,
        slot: slot + 1,
      });
    }
  }

  if (seeded.length !== 28) {
    throw new Error(`Expected 28 teams, got ${seeded.length}`);
  }

  return seeded;
}

export async function runMCIA2026Seed(config: MCIA2026SeedConfig): Promise<string> {
  const { db, adminId } = config;
  const tournamentName = config.tournamentName ?? 'MCIA Badminton 2026';
  const startDateOffset = config.startDateOffset ?? 7;

  const seededTeams = buildSeededTeams();

  console.log('\n[2] Creating MCIA 2026 tournament...');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startDateOffset);
  startDate.setHours(8, 0, 0, 0);

  const tRef = await addDoc(collection(db, 'tournaments'), {
    name: tournamentName,
    description: "MCIA Badminton 2026 - Men's Doubles pool seeding dataset",
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'MCIA Tournament Venue',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 12 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 80,
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
  const tournamentId = tRef.id;
  console.log(`  Created tournament: ${tournamentId}`);

  console.log('\n[3] Creating category: Men\'s Doubles...');
  const cRef = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
    tournamentId,
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'setup',
    seedingEnabled: true,
    teamsPerPool: 4,
    poolSeedingMethod: 'serpentine',
    poolQualifiersPerGroup: 2,
    maxParticipants: 28,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const categoryId = cRef.id;
  console.log(`  Created category: Men's Doubles (${categoryId})`);

  console.log('\n[4] Creating courts...');
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

  console.log('\n[5] Creating players + team registrations...');
  const playerIdByName = new Map<string, string>();

  const getOrCreatePlayer = async (fullName: string): Promise<string> => {
    const normalized = normalizeName(fullName);
    const key = normalized.toLowerCase();
    const existing = playerIdByName.get(key);
    if (existing) return existing;

    const { firstName, lastName } = splitPersonName(normalized);
    const safeEmail = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');

    const pRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), {
      firstName,
      lastName,
      email: `${safeEmail || 'player'}@mcia2026.local`,
      phone: '555-0000',
      gender: 'male',
      skillLevel: 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    playerIdByName.set(key, pRef.id);
    return pRef.id;
  };

  for (const team of seededTeams) {
    const playerId = await getOrCreatePlayer(team.player1);
    const partnerPlayerId = await getOrCreatePlayer(team.player2);

    await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId,
      participantType: 'team',
      playerId,
      partnerPlayerId,
      teamName: team.teamName,
      status: 'approved',
      seed: team.seed,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  console.log(`  Created ${playerIdByName.size} unique players`);
  console.log(`  Created ${seededTeams.length} team registrations`);

  console.log('\n[6] Seed audit (seed -> group slot -> team)');
  for (const team of seededTeams) {
    console.log(`  Seed ${String(team.seed).padStart(2, '0')}: ${team.group}${team.slot} -> ${team.teamName}`);
  }

  console.log('\n' + '='.repeat(64));
  console.log('  MCIA 2026 seed completed successfully');
  console.log('='.repeat(64));
  console.log(`\n  Tournament ID: ${tournamentId}`);
  console.log(`  Category ID:   ${categoryId}`);
  console.log("  Next: Open UI -> Men's Doubles -> Generate Bracket -> Create Schedule");
  console.log('');

  return tournamentId;
}
