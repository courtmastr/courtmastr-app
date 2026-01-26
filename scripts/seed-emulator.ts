/**
 * Seed script for Firebase Emulator
 * Creates an admin user and demo tournament data for testing
 *
 * Run with: npm run seed
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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

// Firebase config for emulator (minimal config needed)
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

// Demo data
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

const DEMO_PLAYERS = [
  { name: 'John Smith', email: 'john@example.com', phone: '555-0101' },
  { name: 'Sarah Johnson', email: 'sarah@example.com', phone: '555-0102' },
  { name: 'Mike Chen', email: 'mike@example.com', phone: '555-0103' },
  { name: 'Emily Davis', email: 'emily@example.com', phone: '555-0104' },
  { name: 'David Wilson', email: 'david@example.com', phone: '555-0105' },
  { name: 'Lisa Brown', email: 'lisa@example.com', phone: '555-0106' },
  { name: 'James Taylor', email: 'james@example.com', phone: '555-0107' },
  { name: 'Amanda Martinez', email: 'amanda@example.com', phone: '555-0108' },
  { name: 'Robert Anderson', email: 'robert@example.com', phone: '555-0109' },
  { name: 'Jennifer Thomas', email: 'jennifer@example.com', phone: '555-0110' },
  { name: 'William Jackson', email: 'william@example.com', phone: '555-0111' },
  { name: 'Jessica White', email: 'jessica@example.com', phone: '555-0112' },
  { name: 'Christopher Lee', email: 'chris@example.com', phone: '555-0113' },
  { name: 'Ashley Harris', email: 'ashley@example.com', phone: '555-0114' },
  { name: 'Daniel Clark', email: 'daniel@example.com', phone: '555-0115' },
  { name: 'Michelle Lewis', email: 'michelle@example.com', phone: '555-0116' },
];

async function createUser(userData: { email: string; password: string; displayName: string }, role: string) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    await updateProfile(user, { displayName: userData.displayName });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: userData.email,
      displayName: userData.displayName,
      role: role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Created ${role} user: ${userData.email}`);
    return user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`ℹ️  User already exists: ${userData.email}`);
      return null;
    }
    throw error;
  }
}

async function createTournament(adminId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // Start in 7 days

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2); // 2-day tournament

  const registrationDeadline = new Date();
  registrationDeadline.setDate(registrationDeadline.getDate() + 5); // Registration closes in 5 days

  const tournamentData = {
    name: 'Spring Badminton Championship 2025',
    description: 'Annual spring championship featuring singles and doubles categories. All skill levels welcome!',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'registration',
    location: 'City Sports Complex, Main Hall',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    registrationDeadline: Timestamp.fromDate(registrationDeadline),
    maxParticipants: 32,
    settings: {
      pointsToWin: 21,
      minPointDifference: 2,
      maxPoints: 30,
      gamesPerMatch: 3,
      minRestMinutes: 15,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const tournamentRef = await addDoc(collection(db, 'tournaments'), tournamentData);
  console.log(`✅ Created tournament: ${tournamentData.name}`);

  return tournamentRef.id;
}

async function createCategories(tournamentId: string) {
  const categories = [
    {
      name: "Men's Singles",
      type: 'singles',
      gender: 'male',
      ageGroup: 'open',
      skillLevel: 'all',
      maxParticipants: 16,
      seedingMethod: 'random',
      format: 'single_elimination',
    },
    {
      name: "Women's Singles",
      type: 'singles',
      gender: 'female',
      ageGroup: 'open',
      skillLevel: 'all',
      maxParticipants: 16,
      seedingMethod: 'random',
      format: 'single_elimination',
    },
    {
      name: "Mixed Doubles",
      type: 'doubles',
      gender: 'mixed',
      ageGroup: 'open',
      skillLevel: 'all',
      maxParticipants: 8,
      seedingMethod: 'random',
      format: 'single_elimination',
    },
  ];

  const categoryIds: string[] = [];

  for (const category of categories) {
    const categoryRef = await addDoc(
      collection(db, 'tournaments', tournamentId, 'categories'),
      {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    categoryIds.push(categoryRef.id);
    console.log(`  ✅ Created category: ${category.name}`);
  }

  return categoryIds;
}

async function createCourts(tournamentId: string) {
  const courts = [
    { name: 'Court 1', location: 'Main Hall - North', status: 'available' },
    { name: 'Court 2', location: 'Main Hall - Center', status: 'available' },
    { name: 'Court 3', location: 'Main Hall - South', status: 'available' },
    { name: 'Court 4', location: 'Auxiliary Hall', status: 'available' },
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
    console.log(`  ✅ Created court: ${court.name}`);
  }
}

async function createPlayersAndRegistrations(tournamentId: string, categoryIds: string[]) {
  const mensCategoryId = categoryIds[0];
  const womensCategoryId = categoryIds[1];

  // Create players and register them
  for (let i = 0; i < DEMO_PLAYERS.length; i++) {
    const player = DEMO_PLAYERS[i];

    // Create player document
    const playerRef = await addDoc(
      collection(db, 'tournaments', tournamentId, 'players'),
      {
        ...player,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    // Assign to category (alternate between men's and women's for demo)
    const categoryId = i % 2 === 0 ? mensCategoryId : womensCategoryId;

    // Create registration
    await addDoc(
      collection(db, 'tournaments', tournamentId, 'registrations'),
      {
        playerId: playerRef.id,
        playerName: player.name,
        categoryId: categoryId,
        status: i < 12 ? 'approved' : 'pending', // First 12 approved, rest pending
        seed: i < 12 ? Math.floor(i / 2) + 1 : null,
        checkedIn: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  }

  console.log(`  ✅ Created ${DEMO_PLAYERS.length} players with registrations`);
}

async function createSecondTournament(adminId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30); // Start in 30 days

  const tournamentData = {
    name: 'Summer League Round Robin',
    description: 'Weekly round robin league matches throughout the summer season.',
    sport: 'badminton',
    format: 'round_robin',
    status: 'draft',
    location: 'Community Center Courts',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000)), // 60 days
    maxParticipants: 16,
    settings: {
      pointsToWin: 21,
      minPointDifference: 2,
      maxPoints: 30,
      gamesPerMatch: 3,
      minRestMinutes: 10,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, 'tournaments'), tournamentData);
  console.log(`✅ Created tournament: ${tournamentData.name}`);
}

async function createCompletedTournament(adminId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14); // Started 14 days ago

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);

  const tournamentData = {
    name: 'Winter Classic 2024',
    description: 'Completed winter championship tournament.',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'completed',
    location: 'Downtown Sports Arena',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    maxParticipants: 16,
    settings: {
      pointsToWin: 21,
      minPointDifference: 2,
      maxPoints: 30,
      gamesPerMatch: 3,
      minRestMinutes: 15,
    },
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, 'tournaments'), tournamentData);
  console.log(`✅ Created tournament: ${tournamentData.name}`);
}

async function main() {
  console.log('\n🏸 CourtMaster Emulator Seed Script\n');
  console.log('=' .repeat(50));

  try {
    // Create users
    console.log('\n📧 Creating users...\n');
    const adminId = await createUser(ADMIN_USER, 'admin');
    await createUser(SCOREKEEPER_USER, 'scorekeeper');

    if (!adminId) {
      console.log('\n⚠️  Admin user already exists. Skipping data creation.');
      console.log('   To reset, stop emulators and run: firebase emulators:start --project demo-courtmaster\n');
      process.exit(0);
    }

    // Create main tournament with full data
    console.log('\n🏆 Creating tournaments...\n');
    const tournamentId = await createTournament(adminId);

    console.log('\n📋 Setting up tournament data...\n');
    const categoryIds = await createCategories(tournamentId);
    await createCourts(tournamentId);
    await createPlayersAndRegistrations(tournamentId, categoryIds);

    // Create additional tournaments
    await createSecondTournament(adminId);
    await createCompletedTournament(adminId);

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Seed completed successfully!\n');
    console.log('📝 Login credentials:');
    console.log('   Admin:       admin@courtmaster.local / admin123');
    console.log('   Scorekeeper: scorekeeper@courtmaster.local / score123');
    console.log('\n🌐 App URL: http://localhost:3000');
    console.log('🔧 Emulator UI: http://localhost:4000\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
