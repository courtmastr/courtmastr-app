const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp, Timestamp, doc, deleteDoc, getDocs, connectFirestoreEmulator } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, connectAuthEmulator } = require('firebase/auth');

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
  storageBucket: 'demo-courtmaster.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to Firebase emulators
connectFirestoreEmulator(db, 'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099');
console.log('✓ Connected to Firebase emulators');

const testTournaments = [];

async function login() {
  try {
    await signInWithEmailAndPassword(auth, 'admin@courtmaster.local', 'admin123');
    console.log('✓ Logged in as admin');
  } catch (e) {
    console.log('Already logged in or auth not required in emulator');
  }
}

async function createTestTournament() {
  const timestamp = Date.now();
  const tournamentData = {
    name: `E2E Test Tournament ${timestamp}`,
    description: 'Test tournament for E2E testing',
    location: 'Test Location',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'draft',
    startDate: Timestamp.fromDate(new Date()),
    endDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
    settings: {
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
      minRestTimeMinutes: 15,
      matchDurationMinutes: 30,
      allowSelfRegistration: true,
      requireApproval: true,
    },
    createdBy: 'test-admin-id',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
  console.log(`✓ Created tournament: ${docRef.id}`);
  
  testTournaments.push(docRef.id);

  const categoryIds = await addCategories(docRef.id);
  await addCourts(docRef.id);
  const playerIds = await addPlayers(docRef.id);
  await addRegistrations(docRef.id, categoryIds, playerIds);

  return docRef.id;
}

async function addCategories(tournamentId) {
  const categories = [
    { name: "Men's Singles", type: 'singles', gender: 'men', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true, status: 'setup' },
    { name: "Women's Singles", type: 'singles', gender: 'women', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true, status: 'setup' },
  ];

  const categoryIds = [];
  for (const category of categories) {
    const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/categories`), {
      ...category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    categoryIds.push(docRef.id);
  }
  console.log(`✓ Added categories to ${tournamentId}`);
  return categoryIds;
}

async function addCourts(tournamentId) {
  const courts = [
    { name: 'Court 1', number: 1, status: 'available' },
    { name: 'Court 2', number: 2, status: 'available' },
  ];
  
  for (const court of courts) {
    await addDoc(collection(db, `tournaments/${tournamentId}/courts`), {
      ...court,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`✓ Added courts to ${tournamentId}`);
}

async function addPlayers(tournamentId) {
  const players = [
    { firstName: 'John', lastName: 'Doe', email: 'john@test.com', phone: '555-0001' },
    { firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', phone: '555-0002' },
    { firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com', phone: '555-0003' },
    { firstName: 'Alice', lastName: 'Brown', email: 'alice@test.com', phone: '555-0004' },
  ];

  const playerIds = [];
  for (const player of players) {
    const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/players`), {
      ...player,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    playerIds.push(docRef.id);
  }
  console.log(`✓ Added players to ${tournamentId}`);
  return playerIds;
}

async function addRegistrations(tournamentId, categoryIds, playerIds) {
  // Add 4 approved registrations for Men's Singles to enable seeding
  const registrations = [
    { playerId: playerIds[0], categoryId: categoryIds[0], status: 'approved', participantType: 'player', registeredBy: 'test-admin-id' },
    { playerId: playerIds[1], categoryId: categoryIds[0], status: 'approved', participantType: 'player', registeredBy: 'test-admin-id' },
    { playerId: playerIds[2], categoryId: categoryIds[0], status: 'approved', participantType: 'player', registeredBy: 'test-admin-id' },
    { playerId: playerIds[3], categoryId: categoryIds[0], status: 'approved', participantType: 'player', registeredBy: 'test-admin-id' },
  ];

  for (const reg of registrations) {
    await addDoc(collection(db, `tournaments/${tournamentId}/registrations`), {
      ...reg,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`✓ Added registrations to ${tournamentId}`);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test tournaments...');
  for (const tournamentId of testTournaments) {
    try {
      await deleteDoc(doc(db, 'tournaments', tournamentId));
      console.log(`✓ Deleted tournament: ${tournamentId}`);
    } catch (e) {
      console.log(`✗ Failed to delete tournament: ${tournamentId}`);
    }
  }
}

async function main() {
  console.log('🌱 Creating test tournament for E2E tests...\n');
  
  try {
    await login();
    const tournamentId = await createTestTournament();
    
    console.log('\n✅ Test tournament created successfully!');
    console.log(`Tournament ID: ${tournamentId}`);
    console.log('\nSet this environment variable to use in tests:');
    console.log(`export TEST_TOURNAMENT_ID=${tournamentId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTestTournament, cleanup };
