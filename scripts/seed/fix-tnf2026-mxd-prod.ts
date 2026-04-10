/**
 * TNF 2026 — Mixed Doubles Production Fix
 *
 * Clears the stale MXD bracket data (stage, participant, match, match_scores)
 * and rebuilds all 16 registrations from the authoritative corrected roster,
 * with correct names, emails, phone numbers, and seeds 1–16.
 *
 * Safe to run when the tournament has not yet started.
 *
 * Run: npm run seed:fix-tnf2026-mxd:prod
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import {
  repairExistingMixedDoublesRegistrations,
  TNF_2026_TOURNAMENT_NAME,
} from './tnf2026-core';

const app = initializeApp({
  apiKey: 'AIzaSyAiCLrYmiFZyM_fNVxVvf34AaVHn_bPWOY',
  authDomain: 'courtmaster-v2.firebaseapp.com',
  projectId: 'courtmaster-v2',
  storageBucket: 'courtmaster-v2.firebasestorage.app',
  messagingSenderId: '137312981992',
  appId: '1:137312981992:web:a27ff1730942f3d2850a5d',
});

const auth = getAuth(app);
const db = getFirestore(app);

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(64)}`);
  console.log('  Fix: TNF 2026 Mixed Doubles (Production)');
  console.log('='.repeat(64));
  console.log('\n  This will:');
  console.log('    1. Delete all MXD bracket docs (stage / participant / match / match_scores)');
  console.log("    2. Reset MXD category status → 'registration'");
  console.log('    3. Delete the existing MXD registrations');
  console.log('    4. Create 16 correct registrations (seeds 1–16)');
  console.log('\n  Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    console.log('[1] Signing in as admin...');
    const credential = await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
    const adminId = credential.user.uid;
    console.log(`  Admin UID: ${adminId}`);

    console.log('\n[2] Locating TNF 2026 tournament...');
    const tournamentSnapshot = await getDocs(
      query(collection(db, 'tournaments'), where('name', '==', TNF_2026_TOURNAMENT_NAME)),
    );

    if (tournamentSnapshot.empty) {
      throw new Error(`TNF 2026 tournament not found: "${TNF_2026_TOURNAMENT_NAME}"`);
    }

    const tournamentId = tournamentSnapshot.docs[0].id;
    console.log(`  Tournament ID: ${tournamentId}`);

    console.log('\n[3] Repairing Mixed Doubles (force=true)...');
    await repairExistingMixedDoublesRegistrations(db, tournamentId, adminId, true);

    console.log(`\n${'='.repeat(64)}`);
    console.log('  Mixed Doubles fix completed successfully!');
    console.log('='.repeat(64));
    console.log('\n  Verify in Firestore console:');
    console.log("  - MXD category status = 'registration'");
    console.log('  - Exactly 16 registrations, seeds 1–16');
    console.log('  - Sudhan Sekar / Ritchel Salvador as seed 1');
    console.log('  - Abhiram Madugula / Donna Shippy as seed 2');
    console.log('  - No docs in stage, participant, match, match_scores subcollections');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nFix failed:', error);
    process.exit(1);
  }
}

main();
