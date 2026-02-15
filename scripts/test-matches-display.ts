/**
 * Test script to verify matches are loading correctly
 * Run with: npx ts-node scripts/test-matches-display.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

const TOURNAMENT_ID = '3DJe3nq66JrAg2O8yvHN';
const CATEGORY_ID = 'V1ObxBQSXhUc7utzj8zz';

async function testMatchesDisplay() {
  console.log('=== Testing Matches Display ===\n');

  try {
    // Step 1: Get stages
    console.log('1. Fetching stages...');
    const stagePath = `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/stage`;
    const stageSnap = await getDocs(collection(db, stagePath));
    const stageIds = stageSnap.docs.map(d => d.id);
    console.log(`   Found ${stageIds.length} stages:`, stageIds);

    if (stageIds.length === 0) {
      console.error('   ERROR: No stages found!');
      return;
    }

    // Step 2: Convert to numeric (THE FIX)
    const numericStageIds = stageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    console.log(`   Numeric stage IDs:`, numericStageIds);

    // Step 3: Query matches with numeric stage_ids
    console.log('\n2. Fetching matches with numeric stage_ids...');
    const matchPath = `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/match`;
    const matchQuery = query(collection(db, matchPath), where('stage_id', 'in', numericStageIds));
    const matchSnap = await getDocs(matchQuery);
    console.log(`   Found ${matchSnap.docs.length} matches`);

    // Step 4: Show first few matches
    if (matchSnap.docs.length > 0) {
      console.log('\n3. Sample matches:');
      matchSnap.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`   - Match ${doc.id}: stage_id=${data.stage_id}, number=${data.number}`);
      });
    }

    // Step 5: Test with string stage_ids (should return 0 results)
    console.log('\n4. Testing with STRING stage_ids (old broken behavior)...');
    const brokenQuery = query(collection(db, matchPath), where('stage_id', 'in', stageIds));
    const brokenSnap = await getDocs(brokenQuery);
    console.log(`   Found ${brokenSnap.docs.length} matches (should be 0 due to type mismatch)`);

    // Summary
    console.log('\n=== TEST RESULTS ===');
    if (matchSnap.docs.length > 0) {
      console.log('✅ PASS: Matches are loading with numeric stage_ids');
      console.log(`   Total matches: ${matchSnap.docs.length}`);
    } else {
      console.log('❌ FAIL: No matches found even with numeric stage_ids');
    }

    if (brokenSnap.docs.length === 0) {
      console.log('✅ PASS: String stage_ids return 0 results (confirms type mismatch issue)');
    } else {
      console.log('⚠️  WARNING: String stage_ids also returned results');
    }

  } catch (err) {
    console.error('❌ ERROR:', err);
  }
}

testMatchesDisplay().then(() => process.exit(0));
