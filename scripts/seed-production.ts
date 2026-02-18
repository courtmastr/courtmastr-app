/**
 * Production Tournament Seed Script
 * Creates a tournament with 2 categories for production testing
 * - Men's Singles (Double Elimination)
 * - Mixed Doubles (Single Elimination)
 *
 * Run with: npx tsx scripts/seed-production.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Production Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAiCLrYmiFZyM_fNVxVvf34AaVHn_bPWOY",
  authDomain: "courtmaster-v2.firebaseapp.com",
  projectId: "courtmaster-v2",
  storageBucket: "courtmaster-v2.firebasestorage.app",
  messagingSenderId: "137312981992",
  appId: "1:137312981992:web:a27ff1730942f3d2850a5d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Categories configuration
const CATEGORIES = [
  {
    name: "Men's Singles",
    type: 'singles',
    format: 'double_elimination',
  },
  {
    name: "Mixed Doubles",
    type: 'doubles',
    format: 'single_elimination',
  },
];

// Unique player names - no duplicates
const SINGLES_PLAYERS = [
  { first: 'James', last: 'Anderson' },
  { first: 'Robert', last: 'Baker' },
  { first: 'Michael', last: 'Carter' },
  { first: 'William', last: 'Davis' },
  { first: 'David', last: 'Evans' },
  { first: 'Richard', last: 'Foster' },
  { first: 'Joseph', last: 'Garcia' },
  { first: 'Thomas', last: 'Harris' },
  { first: 'Christopher', last: 'Irving' },
  { first: 'Daniel', last: 'Jones' },
  { first: 'Matthew', last: 'King' },
  { first: 'Anthony', last: 'Lopez' },
];

// Mixed doubles teams - some players also in singles (edge case)
const MIXED_DOUBLES_TEAMS = [
  // Teams where male partner is ALSO in singles (edge case - same player in 2 categories)
  { male: { first: 'James', last: 'Anderson' }, female: { first: 'Emma', last: 'Wilson' } },  // James is in singles too!
  { male: { first: 'Michael', last: 'Carter' }, female: { first: 'Olivia', last: 'Moore' } }, // Michael is in singles too!

  // Regular teams (unique players)
  { male: { first: 'Kevin', last: 'Martinez' }, female: { first: 'Sophia', last: 'Taylor' } },
  { male: { first: 'Brian', last: 'Nelson' }, female: { first: 'Ava', last: 'Thomas' } },
  { male: { first: 'George', last: 'Oliver' }, female: { first: 'Isabella', last: 'Jackson' } },
  { male: { first: 'Edward', last: 'Parker' }, female: { first: 'Mia', last: 'White' } },
  { male: { first: 'Ronald', last: 'Quinn' }, female: { first: 'Charlotte', last: 'Harris' } },
  { male: { first: 'Timothy', last: 'Roberts' }, female: { first: 'Amelia', last: 'Clark' } },
];

function formatFullName(player: { first: string; last: string }): string {
  return `${player.first} ${player.last}`;
}

function formatTeamName(
  malePlayer: { first: string; last: string },
  femalePlayer: { first: string; last: string }
): string {
  return `${formatFullName(malePlayer)} / ${formatFullName(femalePlayer)}`;
}

// Function to create an admin user if it doesn't exist
async function createAdminUser() {
  const email = 'admin@courtmaster.local';
  const password = 'admin123';
  const displayName = 'Tournament Admin';

  try {
    // Try to sign in first
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    console.log('  Found existing admin user');
    return user.uid;
  } catch (signInError: any) {
    if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password') {
      // The user doesn't exist or password is wrong, so we need to create it manually via Firebase Console
      // Since we can't programmatically create users without email verification in production,
      // we'll just log what needs to be done
      console.log('  Admin user not found. Please create admin user manually in Firebase Console:');
      console.log('  - Go to Firebase Console > Authentication > Users');
      console.log('  - Create user with email: admin@courtmaster.local');
      console.log('  - Password: admin123');
      console.log('  - Then create the user document in Firestore users collection:');
      console.log('    - Document ID: [USER_UID]');
      console.log('    - Fields: email, displayName, role=admin');
      console.log('');
      console.log('Alternatively, log into the app with any account and promote to admin via Firestore.');
      
      // For this script, we'll use a placeholder admin ID and continue
      // In a real scenario, you'd need to create the user first
      console.log('  Continuing with placeholder admin ID...');
      return 'PLACEHOLDER_ADMIN_ID';
    } else {
      throw signInError;
    }
  }
}

// Create a function to create the tournament with a known admin ID
async function createTournament(adminId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  const tournament = {
    name: 'Production Test Tournament 2026',
    description: 'Production test tournament with 2 categories',
    sport: 'badminton',
    format: 'mixed', // Categories have their own formats
    status: 'registration',
    location: 'Production Sports Complex',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 8 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 100,
    settings: {
      matchDurationMinutes: 20,
      allowSelfRegistration: true,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'tournaments'), tournament);
  console.log(`  Created tournament: ${tournament.name}`);
  return ref.id;
}

async function createCourts(tournamentId: string) {
  for (let i = 1; i <= 4; i++) {
    await addDoc(collection(db, 'tournaments', tournamentId, 'courts'), {
      name: `Court ${i}`,
      number: i,
      status: 'available',
      createdAt: serverTimestamp(),
    });
  }
  console.log('  Created 4 courts');
}

async function createCategories(tournamentId: string) {
  const categoryRefs: { id: string; config: typeof CATEGORIES[0] }[] = [];

  for (const cat of CATEGORIES) {
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
      name: cat.name,
      type: cat.type,
      format: cat.format,
      status: 'setup',
      seedingEnabled: true,
      maxParticipants: cat.type === 'singles' ? 16 : 8,
      createdAt: serverTimestamp(),
    });
    categoryRefs.push({ id: ref.id, config: cat });
    console.log(`  Created category: ${cat.name} (${cat.format})`);
  }

  return categoryRefs;
}

async function createPlayersAndRegistrations(
  tournamentId: string,
  categories: { id: string; config: typeof CATEGORIES[0] }[]
) {
  // Track player IDs by name to reuse for players in multiple categories
  const playerIdMap: Map<string, string> = new Map();

  // Helper to create or get existing player
  async function getOrCreatePlayer(first: string, last: string, gender: 'male' | 'female'): Promise<string> {
    const key = `${first}-${last}`;
    if (playerIdMap.has(key)) {
      return playerIdMap.get(key)!;
    }

    const playerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), {
      firstName: first,
      lastName: last,
      gender,
      createdAt: serverTimestamp(),
    });
    playerIdMap.set(key, playerRef.id);
    return playerRef.id;
  }

  // Find categories
  const singlesCategory = categories.find(c => c.config.name === "Men's Singles");
  const doublesCategory = categories.find(c => c.config.name === "Mixed Doubles");

  // Create Men's Singles players and registrations
  if (singlesCategory) {
    console.log(`\n  Men's Singles:`);
    for (let i = 0; i < SINGLES_PLAYERS.length; i++) {
      const player = SINGLES_PLAYERS[i];
      const playerId = await getOrCreatePlayer(player.first, player.last, 'male');

      await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
        categoryId: singlesCategory.id,
        participantType: 'player',
        playerId,
        status: 'approved',
        seed: i + 1,
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
    console.log(`    Created ${SINGLES_PLAYERS.length} players`);
  }

  // Create Mixed Doubles teams and registrations
  if (doublesCategory) {
    console.log(`\n  Mixed Doubles:`);
    for (let i = 0; i < MIXED_DOUBLES_TEAMS.length; i++) {
      const team = MIXED_DOUBLES_TEAMS[i];

      // Get or create male player (might already exist from singles!)
      const maleId = await getOrCreatePlayer(team.male.first, team.male.last, 'male');
      // Create female player (always new)
      const femaleId = await getOrCreatePlayer(team.female.first, team.female.last, 'female');

      await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
        categoryId: doublesCategory.id,
        participantType: 'team',
        playerId: maleId,
        partnerPlayerId: femaleId,
        teamName: formatTeamName(team.male, team.female),
        status: 'approved',
        seed: i + 1,
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
    console.log(`    Created ${MIXED_DOUBLES_TEAMS.length} teams`);
    console.log(`    (2 players are also in Men's Singles: James Anderson, Michael Carter)`);
  }

  console.log(`\n  Total unique players: ${playerIdMap.size}`);
}

async function main() {
  console.log('\n');
  console.log('='.repeat(50));
  console.log('  Production Tournament Seed');
  console.log('='.repeat(50));

  try {
    console.log('\n[1/5] Checking for admin user...');
    const adminId = await createAdminUser();

    console.log('\n[2/5] Creating tournament...');
    const tournamentId = await createTournament(adminId);

    console.log('\n[3/5] Creating courts...');
    await createCourts(tournamentId);

    console.log('\n[4/5] Creating categories...');
    const categories = await createCategories(tournamentId);

    console.log('\n[5/5] Creating players and registrations...');
    await createPlayersAndRegistrations(tournamentId, categories);

    console.log('\n' + '='.repeat(50));
    console.log('  Production seed completed successfully!');
    console.log('='.repeat(50));
    console.log(`\n  Tournament ID: ${tournamentId}`);
    console.log('  Categories:');
    console.log(`    - Men's Singles (Double Elimination) - ${SINGLES_PLAYERS.length} players`);
    console.log(`    - Mixed Doubles (Single Elimination) - ${MIXED_DOUBLES_TEAMS.length} teams`);
    console.log('\n  Edge Cases:');
    console.log('    - James Anderson: registered in BOTH Singles AND Mixed Doubles');
    console.log('    - Michael Carter: registered in BOTH Singles AND Mixed Doubles');
    console.log('\n  Login: admin@courtmaster.local / admin123');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
