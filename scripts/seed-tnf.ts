/**
 * TNF Tournament Seed Script
 * Creates a realistic TNF tournament with all categories and edge cases
 *
 * Run with: npm run seed:tnf
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Firebase config for emulator
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);

// Users
const ADMIN_USER = {
  email: 'admin@courtmaster.local',
  password: 'admin123',
  displayName: 'Tournament Admin',
};

const SCOREKEEPER_USER = {
  email: 'scorekeeper@courtmaster.local',
  password: 'score123',
  displayName: 'Court Scorekeeper',
};

// Player name generators
const FIRST_NAMES_MALE = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven',
  'Andrew', 'Paul', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy',
  'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas'
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa',
  'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young'
];

// TNF Categories Configuration
const TNF_CATEGORIES = [
  // Round Robin categories (guaranteed min 3 games)
  {
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'round_robin',
    minGamesGuaranteed: 3,
    maxParticipants: 20,
    teamCount: 12, // Good for round robin - 12 teams
    seedingEnabled: true,
  },
  {
    name: "Mixed Doubles",
    type: 'mixed_doubles',
    gender: 'mixed',
    ageGroup: 'open',
    format: 'round_robin',
    minGamesGuaranteed: 3,
    maxParticipants: 20,
    teamCount: 10, // 10 teams
    seedingEnabled: true,
  },
  // Double Elimination categories
  {
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: 'double_elimination',
    maxParticipants: 32,
    teamCount: 16, // Power of 2 - ideal bracket
    seedingEnabled: true,
  },
  // Youth categories - Boys
  {
    name: "Youth Doubles Boys U10",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'u10',
    format: 'double_elimination',
    maxParticipants: 16,
    teamCount: 5, // Edge case: small bracket, needs byes
    seedingEnabled: false,
  },
  {
    name: "Youth Doubles Boys U15",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'u15',
    format: 'double_elimination',
    maxParticipants: 16,
    teamCount: 7, // Edge case: odd number, needs byes
    seedingEnabled: true,
  },
  {
    name: "Youth Doubles Boys U18",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'u18',
    format: 'double_elimination',
    maxParticipants: 16,
    teamCount: 8, // Power of 2 - clean bracket
    seedingEnabled: true,
  },
  // Youth categories - Girls
  {
    name: "Youth Doubles Girls U10",
    type: 'doubles',
    gender: 'women',
    ageGroup: 'u10',
    format: 'double_elimination',
    maxParticipants: 16,
    teamCount: 6, // Even but not power of 2
    seedingEnabled: false,
  },
  {
    name: "Youth Doubles Girls U15",
    type: 'doubles',
    gender: 'women',
    ageGroup: 'u15',
    format: 'double_elimination',
    maxParticipants: 16,
    teamCount: 9, // Edge case: just over 8, needs bracket of 16
    seedingEnabled: true,
  },
  {
    name: "Youth Doubles Girls U18",
    type: 'doubles',
    gender: 'women',
    ageGroup: 'u18',
    format: 'double_elimination',
    maxParticipants: 20,
    teamCount: 11, // Edge case: 11 teams
    seedingEnabled: true,
  },
];

function generatePlayer(gender: 'male' | 'female', index: number) {
  const firstNames = gender === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const firstName = firstNames[index % firstNames.length];
  const lastName = LAST_NAMES[Math.floor(index / 2) % LAST_NAMES.length];

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`,
    phone: `555-${String(1000 + index).padStart(4, '0')}`,
  };
}

async function createUser(userData: { email: string; password: string; displayName: string }, role: string) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    await updateProfile(user, { displayName: userData.displayName });

    await setDoc(doc(db, 'users', user.uid), {
      email: userData.email,
      displayName: userData.displayName,
      role: role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`  Created ${role} user: ${userData.email}`);
    return user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // Sign in to get the UID
      const { user } = await signInWithEmailAndPassword(auth, userData.email, userData.password);

      // Ensure user document exists with correct role (might be missing from previous failed run)
      await setDoc(doc(db, 'users', user.uid), {
        email: userData.email,
        displayName: userData.displayName,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }); // merge: true = update if exists, create if not

      console.log(`  User exists: ${userData.email} (ensured role: ${role})`);
      return user.uid;
    }
    throw error;
  }
}

async function createTNFTournament(adminId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 3); // Start in 3 days
  startDate.setHours(8, 0, 0, 0); // 8 AM

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1); // 2-day tournament
  endDate.setHours(18, 0, 0, 0);

  const registrationDeadline = new Date();
  registrationDeadline.setDate(registrationDeadline.getDate() + 2);

  const tournamentData = {
    name: 'TNF Badminton Tournament 2025',
    description: 'Thursday Night Fever annual tournament featuring singles, doubles, and youth categories. Round robin format for doubles with guaranteed minimum games!',
    sport: 'badminton',
    format: 'double_elimination', // Default format (categories override)
    status: 'registration',
    location: 'TNF Sports Complex',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    registrationDeadline: Timestamp.fromDate(registrationDeadline),
    maxParticipants: 200,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 25,
      allowSelfRegistration: true,
      requireApproval: true,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const tournamentRef = await addDoc(collection(db, 'tournaments'), tournamentData);
  console.log(`\n  Created tournament: ${tournamentData.name}`);

  return tournamentRef.id;
}

async function createCategories(tournamentId: string) {
  const categoryIds: { id: string; config: typeof TNF_CATEGORIES[0] }[] = [];

  for (const category of TNF_CATEGORIES) {
    const { teamCount, ...categoryData } = category;

    const categoryRef = await addDoc(
      collection(db, 'tournaments', tournamentId, 'categories'),
      {
        ...categoryData,
        status: 'setup',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    categoryIds.push({ id: categoryRef.id, config: category });
    console.log(`  Created category: ${category.name} (${category.format}, ${category.teamCount} teams)`);
  }

  return categoryIds;
}

async function createCourts(tournamentId: string) {
  const courts = [
    { name: 'Court 1', number: 1, status: 'available' },
    { name: 'Court 2', number: 2, status: 'available' },
    { name: 'Court 3', number: 3, status: 'available' },
    { name: 'Court 4', number: 4, status: 'available' },
    { name: 'Court 5', number: 5, status: 'available' },
    { name: 'Court 6', number: 6, status: 'available' },
    { name: 'Court 7', number: 7, status: 'maintenance' }, // Edge case: one court in maintenance
    { name: 'Court 8', number: 8, status: 'available' },
  ];

  for (const court of courts) {
    await addDoc(
      collection(db, 'tournaments', tournamentId, 'courts'),
      {
        ...court,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  }
  console.log(`  Created ${courts.length} courts (1 in maintenance)`);
}

async function createPlayersAndRegistrations(
  tournamentId: string,
  categoryIds: { id: string; config: typeof TNF_CATEGORIES[0] }[]
) {
  let playerIndex = 0;
  let totalPlayers = 0;
  let totalRegistrations = 0;

  for (const { id: categoryId, config } of categoryIds) {
    const isDoubles = config.type === 'doubles' || config.type === 'mixed_doubles';
    const isMixed = config.type === 'mixed_doubles';
    const isYouth = config.ageGroup !== 'open';
    const isGirls = config.gender === 'women';

    console.log(`\n  Populating: ${config.name}`);

    for (let teamNum = 0; teamNum < config.teamCount; teamNum++) {
      // For doubles, create 2 players per team
      const playersPerTeam = isDoubles ? 2 : 1;
      const playerIds: string[] = [];
      let teamName = '';

      for (let p = 0; p < playersPerTeam; p++) {
        let gender: 'male' | 'female';

        if (isMixed) {
          gender = p === 0 ? 'male' : 'female';
        } else if (isGirls) {
          gender = 'female';
        } else {
          gender = 'male';
        }

        const player = generatePlayer(gender, playerIndex++);

        // Add age suffix for youth players
        let displayName = player.name;
        if (isYouth) {
          const ageMap: Record<string, number> = { 'u10': 8, 'u12': 10, 'u15': 13, 'u18': 16 };
          const age = ageMap[config.ageGroup] || 15;
          displayName = `${player.name} (${age + Math.floor(Math.random() * 2)})`;
        }

        const playerRef = await addDoc(
          collection(db, 'tournaments', tournamentId, 'players'),
          {
            firstName: player.firstName,
            lastName: player.lastName,
            email: player.email,
            phone: player.phone,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );

        playerIds.push(playerRef.id);
        totalPlayers++;

        if (p === 0) {
          teamName = player.lastName;
        } else {
          teamName += ` / ${player.lastName}`;
        }
      }

      // Determine registration status with edge cases
      let status: string;
      let seed: number | null = null;

      if (teamNum < Math.floor(config.teamCount * 0.6)) {
        // 60% approved
        status = 'approved';
        if (config.seedingEnabled && teamNum < 4) {
          seed = teamNum + 1; // Top 4 are seeded
        }
      } else if (teamNum < Math.floor(config.teamCount * 0.8)) {
        // 20% checked in (already approved and arrived)
        status = 'checked_in';
      } else if (teamNum < Math.floor(config.teamCount * 0.95)) {
        // 15% pending
        status = 'pending';
      } else {
        // 5% withdrawn (edge case)
        status = 'withdrawn';
      }

      // Create registration
      await addDoc(
        collection(db, 'tournaments', tournamentId, 'registrations'),
        {
          categoryId,
          participantType: isDoubles ? 'team' : 'player',
          playerId: playerIds[0],
          partnerPlayerId: playerIds[1] || null,
          teamName: isDoubles ? teamName : null,
          status,
          seed,
          checkedIn: status === 'checked_in',
          registeredBy: 'seed-script',
          registeredAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      totalRegistrations++;
    }

    console.log(`    - ${config.teamCount} registrations created`);
  }

  console.log(`\n  Total: ${totalPlayers} players, ${totalRegistrations} registrations`);
}

async function main() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  TNF Tournament Seed Script');
  console.log('='.repeat(60));

  try {
    // Create users
    console.log('\n[1/5] Creating users...');
    const adminId = await createUser(ADMIN_USER, 'admin');
    await createUser(SCOREKEEPER_USER, 'scorekeeper');

    // Small delay to ensure user document is available for Firestore rules
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create TNF tournament
    console.log('\n[2/5] Creating TNF tournament...');
    const tournamentId = await createTNFTournament(adminId);

    // Create categories
    console.log('\n[3/5] Creating categories...');
    const categoryIds = await createCategories(tournamentId);

    // Create courts
    console.log('\n[4/5] Creating courts...');
    await createCourts(tournamentId);

    // Create players and registrations
    console.log('\n[5/5] Creating players and registrations...');
    await createPlayersAndRegistrations(tournamentId, categoryIds);

    console.log('\n' + '='.repeat(60));
    console.log('\n  TNF Tournament seeded successfully!\n');
    console.log('  Categories Summary:');
    console.log('  -------------------');
    for (const cat of TNF_CATEGORIES) {
      console.log(`  ${cat.name.padEnd(28)} ${cat.format.padEnd(20)} ${cat.teamCount} teams`);
    }
    console.log('\n  Edge Cases Included:');
    console.log('  - Round Robin with min 3 games (Men\'s Doubles, Mixed Doubles)');
    console.log('  - Double Elimination with various bracket sizes');
    console.log('  - Youth categories with age groups (U10, U15, U18)');
    console.log('  - Odd team counts requiring byes (5, 7, 9, 11 teams)');
    console.log('  - Power of 2 brackets (8, 16 teams)');
    console.log('  - Mixed registration statuses (approved, pending, checked_in, withdrawn)');
    console.log('  - Seeded and unseeded categories');
    console.log('  - Court in maintenance status');
    console.log('\n  Login credentials:');
    console.log('  Admin:       admin@courtmaster.local / admin123');
    console.log('  Scorekeeper: scorekeeper@courtmaster.local / score123');
    console.log('\n  App URL: http://localhost:3000');
    console.log('  Emulator UI: http://localhost:4000\n');

  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
