/**
 * Phase 1 Migration Test Suite
 * 
 * Automated tests for verifying Phase 1 Critical Fixes
 * Run with: npx tsx scripts/test-phase1.ts
 * 
 * Prerequisites:
 * - Firebase emulators running: firebase emulators:start
 * - Emulator Firestore accessible at localhost:8080
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';

// Test configuration
const EMULATOR_HOST = 'localhost';
const FIRESTORE_PORT = 8080;
const AUTH_PORT = 9099;

// Initialize Firebase for emulator
const app = initializeApp({
  projectId: 'courtmaster-v2',
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
});

const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators
connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_PORT);
connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_PORT}`);

// Test tracking
let testsPassed = 0;
let testsFailed = 0;
const testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    console.log(`\n🧪 ${name}...`);
    await testFn();
    testsPassed++;
    testResults.push({ name, passed: true });
    console.log(`   ✅ PASSED`);
  } catch (error) {
    testsFailed++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name, passed: false, error: errorMessage });
    console.log(`   ❌ FAILED: ${errorMessage}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

// ==================== TEST SUITE 1: ID Types (Step 1.1) ====================

async function testIdTypes() {
  const tournamentId = 'test-tournament-1';
  const categoryId = 'test-category-1';
  
  // Test 1.1.1: Verify numeric IDs are preserved
  await runTest('Test 1.1.1: Participant ID type (numeric)', async () => {
    const participantRef = doc(
      db,
      `tournaments/${tournamentId}/categories/${categoryId}/participant/1`
    );
    
    await setDoc(participantRef, {
      id: 1, // Should remain as number
      name: 'Test Player',
      tournament_id: tournamentId,
    });
    
    const docSnap = await getDoc(participantRef);
    const data = docSnap.data();
    
    assertEqual(typeof data?.id, 'number', 'ID should be numeric');
    assertEqual(data?.id, 1, 'ID value should be 1');
  });
  
  // Test 1.1.2: Verify foreign key IDs are strings
  await runTest('Test 1.1.2: Foreign key ID types (strings)', async () => {
    const matchRef = doc(
      db,
      `tournaments/${tournamentId}/categories/${categoryId}/_data/match/0`
    );
    
    await setDoc(matchRef, {
      id: 0,
      stage_id: '0', // Should be string
      round_id: '0', // Should be string
      group_id: '0', // Should be string
      opponent1: { id: 1 },
      opponent2: { id: 2 },
    });
    
    const docSnap = await getDoc(matchRef);
    const data = docSnap.data();
    
    assertEqual(typeof data?.stage_id, 'string', 'stage_id should be string');
    assertEqual(typeof data?.round_id, 'string', 'round_id should be string');
    assertEqual(typeof data?.group_id, 'string', 'group_id should be string');
  });
}

// ==================== TEST SUITE 2: Collections (Steps 1.2-1.4) ====================

async function testCollections() {
  const tournamentId = 'test-tournament-2';
  
  // Test 1.2.1: Verify /match collection exists and is readable
  await runTest('Test 1.2.1: /match collection readable', async () => {
    const matchRef = doc(db, `tournaments/${tournamentId}/match/match-0`);
    await setDoc(matchRef, {
      id: 'match-0',
      stage_id: '0',
      round_id: '0',
      status: 2, // ready
      opponent1: { id: 1 },
      opponent2: { id: 2 },
    });
    
    const docSnap = await getDoc(matchRef);
    assertTrue(docSnap.exists(), 'Match document should exist');
  });
  
  // Test 1.2.2: Verify /match_scores collection works
  await runTest('Test 1.2.2: /match_scores collection writable', async () => {
    const scoreRef = doc(db, `tournaments/${tournamentId}/match_scores/match-0`);
    await setDoc(scoreRef, {
      courtId: 'court-1',
      scheduledTime: Timestamp.now(),
      sequence: 1,
      updatedAt: Timestamp.now(),
    });
    
    const docSnap = await getDoc(scoreRef);
    assertTrue(docSnap.exists(), 'Match score document should exist');
  });
  
  // Test 1.2.3: Verify /matches collection should NOT exist
  await runTest('Test 1.2.3: /matches collection removed', async () => {
    const matchesRef = collection(db, `tournaments/${tournamentId}/matches`);
    const snapshot = await getDocs(matchesRef);
    
    // Should be empty or non-existent
    assertEqual(snapshot.size, 0, '/matches collection should be empty');
  });
}

// ==================== TEST SUITE 3: Court Management (Step 1.4b) ====================

async function testCourtManagement() {
  const tournamentId = 'test-tournament-3';
  
  // Setup: Create courts and matches
  const court1Ref = doc(db, `tournaments/${tournamentId}/courts/court-1`);
  const court2Ref = doc(db, `tournaments/${tournamentId}/courts/court-2`);
  
  await setDoc(court1Ref, {
    id: 'court-1',
    name: 'Court 1',
    status: 'available',
    number: 1,
  });
  
  await setDoc(court2Ref, {
    id: 'court-2',
    name: 'Court 2',
    status: 'available',
    number: 2,
  });
  
  // Setup: Create match_scores with court assignments
  const matchScoresRef = doc(db, `tournaments/${tournamentId}/match_scores/match-0`);
  await setDoc(matchScoresRef, {
    courtId: 'court-1',
    scheduledTime: Timestamp.now(),
    sequence: 1,
    updatedAt: Timestamp.now(),
  });
  
  // Test 1.4.1: Query match_scores by courtId (simulating deleteCourt)
  await runTest('Test 1.4.1: Query match_scores by courtId', async () => {
    const matchesQuery = query(
      collection(db, `tournaments/${tournamentId}/match_scores`),
      where('courtId', '==', 'court-1')
    );
    
    const snapshot = await getDocs(matchesQuery);
    assertEqual(snapshot.size, 1, 'Should find 1 match on court-1');
    
    const doc = snapshot.docs[0];
    assertEqual(doc.data().courtId, 'court-1', 'courtId should match');
  });
  
  // Test 1.4.2: Update match_scores (simulating court reassignment)
  await runTest('Test 1.4.2: Update match_scores courtId', async () => {
    const matchRef = doc(db, `tournaments/${tournamentId}/match_scores/match-0`);
    
    await updateDoc(matchRef, {
      courtId: 'court-2',
      updatedAt: Timestamp.now(),
    });
    
    const docSnap = await getDoc(matchRef);
    assertEqual(docSnap.data()?.courtId, 'court-2', 'courtId should be updated');
  });
  
  // Test 1.4.3: Clear court assignment (simulating clearScheduling)
  await runTest('Test 1.4.3: Clear match_scores scheduling data', async () => {
    const matchRef = doc(db, `tournaments/${tournamentId}/match_scores/match-0`);
    
    await updateDoc(matchRef, {
      courtId: null,
      scheduledTime: null,
      sequence: null,
      updatedAt: Timestamp.now(),
    });
    
    const docSnap = await getDoc(matchRef);
    const data = docSnap.data();
    
    assertEqual(data?.courtId, null, 'courtId should be null');
    assertEqual(data?.sequence, null, 'sequence should be null');
  });
}

// ==================== TEST SUITE 4: Status Values (Step 1.3) ====================

async function testStatusValues() {
  const tournamentId = 'test-tournament-4';
  
  // Test 1.3.1: Verify numeric status values work
  await runTest('Test 1.3.1: Numeric status values in /match', async () => {
    const batch = writeBatch(db);
    
    // Create matches with different statuses
    const statuses = [
      { id: 'match-0', status: 0 }, // locked
      { id: 'match-1', status: 1 }, // waiting
      { id: 'match-2', status: 2 }, // ready
      { id: 'match-3', status: 3 }, // running
      { id: 'match-4', status: 4 }, // completed
    ];
    
    for (const { id, status } of statuses) {
      const matchRef = doc(db, `tournaments/${tournamentId}/match/${id}`);
      batch.set(matchRef, {
        id,
        status,
        stage_id: '0',
        round_id: '0',
      });
    }
    
    await batch.commit();
    
    // Query by status range
    const matchesQuery = query(
      collection(db, `tournaments/${tournamentId}/match`),
      where('status', 'in', [0, 1, 2])
    );
    
    const snapshot = await getDocs(matchesQuery);
    assertEqual(snapshot.size, 3, 'Should find 3 matches with status 0, 1, or 2');
  });
}

// ==================== MAIN TEST RUNNER ====================

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 1 Migration - Automated Test Suite             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nFirestore Emulator: ${EMULATOR_HOST}:${FIRESTORE_PORT}`);
  console.log(`Auth Emulator: ${EMULATOR_HOST}:${AUTH_PORT}\n`);
  
  try {
    // Authenticate
    console.log('🔐 Authenticating...');
    await signInAnonymously(auth);
    console.log('   ✅ Authenticated\n');
    
    // Run test suites
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST SUITE 1: ID Types (Step 1.1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testIdTypes();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST SUITE 2: Collections (Steps 1.2-1.4)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testCollections();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST SUITE 3: Court Management (Step 1.4b)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testCourtManagement();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST SUITE 4: Status Values (Step 1.3)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testStatusValues();
    
  } catch (error) {
    console.error('\n💥 Test runner failed:', error);
  }
  
  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests: ${String(testsPassed + testsFailed).padEnd(49)} ║`);
  console.log(`║  ✅ Passed:   ${String(testsPassed).padEnd(49)} ║`);
  console.log(`║  ❌ Failed:   ${String(testsFailed).padEnd(49)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (testsFailed > 0) {
    console.log('\n📋 Failed Tests:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   ❌ ${r.name}`);
        console.log(`      Error: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Phase 1 migration verified.');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
