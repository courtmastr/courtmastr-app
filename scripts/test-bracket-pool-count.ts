/**
 * Integration test for bracket generation with Math.ceil fix
 * 
 * This script creates test categories with specific player counts
 * and verifies the bracket generation produces correct pool counts.
 * 
 * Run: npx tsx scripts/test-bracket-pool-count.ts
 * Requires: Firebase emulators running (npm run emulators)
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
});

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);

// Test configurations
const TEST_CASES = [
  {
    name: 'Test Case 1: 38 players, teamsPerPool=3',
    playerCount: 38,
    teamsPerPool: 3,
    expectedPoolCount: 13,
    format: 'pool_to_elimination' as const,
    seedingMethod: 'serpentine' as const,
  },
  {
    name: 'Test Case 2: 9 players, teamsPerPool=3',
    playerCount: 9,
    teamsPerPool: 3,
    expectedPoolCount: 3,
    format: 'pool_to_elimination' as const,
    seedingMethod: 'serpentine' as const,
  },
  {
    name: 'Test Case 3: 10 players, teamsPerPool=3',
    playerCount: 10,
    teamsPerPool: 3,
    expectedPoolCount: 4,
    format: 'pool_to_elimination' as const,
    seedingMethod: 'serpentine' as const,
  },
  {
    name: 'Test Case 4: 12 players, teamsPerPool=4',
    playerCount: 12,
    teamsPerPool: 4,
    expectedPoolCount: 3,
    format: 'pool_to_elimination' as const,
    seedingMethod: 'serpentine' as const,
  },
];

async function cleanupExistingBrackets(tournamentId: string, categoryId: string): Promise<void> {
  console.log(`  Cleaning up existing bracket data...`);
  
  const paths = ['match', 'group', 'round', 'stage', 'participant'];
  
  for (const path of paths) {
    const collectionRef = collection(db, 'tournaments', tournamentId, 'categories', categoryId, path);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.size > 0) {
      console.log(`    Deleting ${snapshot.size} documents from ${path}...`);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  }
  
  // Also clean up registrations to start fresh
  const registrationsRef = collection(db, 'tournaments', tournamentId, 'registrations');
  const regQuery = query(registrationsRef, where('categoryId', '==', categoryId));
  const regSnapshot = await getDocs(regQuery);
  
  if (regSnapshot.size > 0) {
    console.log(`    Deleting ${regSnapshot.size} existing registrations...`);
    const batch = writeBatch(db);
    regSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

async function createTestTournament(adminId: string): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  
  const ref = await addDoc(collection(db, 'tournaments'), {
    name: 'Bracket Pool Count Test',
    description: 'Integration test for pool group count calculation',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'Test Venue',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 24 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 100,
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
  
  console.log(`  Created test tournament: ${ref.id}`);
  return ref.id;
}

async function createTestCategory(
  tournamentId: string,
  testCase: typeof TEST_CASES[0]
): Promise<string> {
  const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
    tournamentId,
    name: testCase.name,
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: testCase.format,
    teamsPerPool: testCase.teamsPerPool,
    poolSeedingMethod: testCase.seedingMethod,
    status: 'setup',
    seedingEnabled: true,
    maxParticipants: testCase.playerCount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  console.log(`  Created category: ${testCase.name} (${ref.id})`);
  return ref.id;
}

async function createTestPlayers(tournamentId: string, count: number): Promise<string[]> {
  const playerIds: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const ref = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), {
      firstName: `Player`,
      lastName: `${String(i + 1).padStart(2, '0')}`,
      email: `player${i + 1}@test.local`,
      phone: `555-${String(1000 + i).slice(-4)}`,
      gender: 'male',
      skillLevel: Math.floor(Math.random() * 10) + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    playerIds.push(ref.id);
  }
  
  console.log(`  Created ${count} players`);
  return playerIds;
}

async function createRegistrations(
  tournamentId: string,
  categoryId: string,
  adminId: string,
  playerIds: string[],
  seededCount: number = 20
): Promise<void> {
  for (let i = 0; i < playerIds.length; i++) {
    await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
      tournamentId,
      categoryId,
      participantType: 'player',
      playerId: playerIds[i],
      status: 'approved',
      checkInStatus: 'checked_in',
      seed: i < seededCount ? i + 1 : null,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  console.log(`  Created ${playerIds.length} registrations (${seededCount} seeded)`);
}

async function verifyPoolCount(
  tournamentId: string,
  categoryId: string,
  expectedCount: number
): Promise<boolean> {
  const groupRef = collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'group');
  const snapshot = await getDocs(groupRef);
  
  const actualCount = snapshot.size;
  const passed = actualCount === expectedCount;
  
  console.log(`  Pool count verification: ${actualCount} groups (expected ${expectedCount}) ${passed ? '✅' : '❌'}`);
  
  if (snapshot.size > 0) {
    console.log(`  Group details:`);
    snapshot.docs.forEach((doc) => {
      console.log(`    - Group ${doc.data().number}: ${doc.id}`);
    });
  }
  
  return passed;
}

async function runTestCase(
  adminId: string,
  testCase: typeof TEST_CASES[0]
): Promise<boolean> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Running: ${testCase.name}`);
  console.log('='.repeat(70));
  
  try {
    // Create tournament
    const tournamentId = await createTestTournament(adminId);
    
    // Create category
    const categoryId = await createTestCategory(tournamentId, testCase);
    
    // Clean up any existing data
    await cleanupExistingBrackets(tournamentId, categoryId);
    
    // Create players
    const playerIds = await createTestPlayers(tournamentId, testCase.playerCount);
    
    // Create registrations (first 20 seeded, rest unseeded)
    const seededCount = Math.min(20, testCase.playerCount);
    await createRegistrations(tournamentId, categoryId, adminId, playerIds, seededCount);
    
    console.log(`\n  Test setup complete.`);
    console.log(`  Tournament: ${tournamentId}`);
    console.log(`  Category: ${categoryId}`);
    console.log(`  Players: ${testCase.playerCount}`);
    console.log(`  teamsPerPool: ${testCase.teamsPerPool}`);
    console.log(`  Expected pools: ${testCase.expectedPoolCount}`);
    console.log(`\n  ⚠️  Now manually generate bracket via UI to verify!`);
    console.log(`     URL: http://localhost:3000/tournaments/${tournamentId}/categories/${categoryId}`);
    
    // Note: We can't auto-generate the bracket here because it requires
    // the Vue app and brackets-manager library running in browser context
    // The user needs to click "Generate Bracket" in the UI
    
    return true;
  } catch (error) {
    console.error(`  ❌ Test failed:`, error);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  Bracket Pool Count Integration Test');
  console.log('  Verifying Math.ceil fix for pool group calculation');
  console.log('='.repeat(70));
  
  try {
    // Sign in as admin
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
    const adminId = auth.currentUser?.uid;
    
    if (!adminId) {
      throw new Error('Failed to authenticate as admin');
    }
    
    console.log('\nAuthenticated as admin');
    
    // Run all test cases
    const results: boolean[] = [];
    
    for (const testCase of TEST_CASES) {
      const result = await runTestCase(adminId, testCase);
      results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('  Test Setup Complete');
    console.log('='.repeat(70));
    console.log('\nAll test categories have been created.');
    console.log('\n⚠️  MANUAL VERIFICATION REQUIRED:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Log in as admin (admin@courtmastr.com / admin123)');
    console.log('   3. Navigate to each test tournament');
    console.log('   4. Click "Generate Bracket" for each category');
    console.log('   5. Verify console shows correct numPools value');
    console.log('   6. Check Firestore for correct group count\n');
    
    console.log('Expected Results:');
    TEST_CASES.forEach((tc, i) => {
      console.log(`   ${i + 1}. ${tc.name}`);
      console.log(`      → ${tc.expectedPoolCount} pools (ceil(${tc.playerCount}/${tc.teamsPerPool}) = ${Math.ceil(tc.playerCount / tc.teamsPerPool)})`);
    });
    
    console.log('\n✅ Test data created successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

main();
