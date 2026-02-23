/**
 * TNF 2025 Production Seed
 *
 * Seeds the 2025_Tnf tournament to the real Firebase production database.
 * Run: npm run seed:tnf2025:prod
 *
 * Requires: Central Illinois Badminton.xlsx file in project root
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { createOrSignIn } from './helpers';
import { runTNF2025Seed } from './tnf2025-core';

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
  console.log('\n' + '='.repeat(64));
  console.log('  Seed: TNF 2025 Tournament (Production)');
  console.log('='.repeat(64));
  console.log('\n  WARNING: Writing to the REAL production database.');
  console.log('  Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    console.log('\n[1] Setting up admin user...');
    const adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });

    // Re-authenticate as admin
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Seeding TNF 2025 tournament...');
    const tournamentId = await runTNF2025Seed({
      db,
      adminId,
      tournamentName: '2025_Tnf',
      startDateOffset: 14,
    });

    console.log('\n' + '='.repeat(64));
    console.log('  TNF 2025 Seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  Tournament ID: ${tournamentId}`);
    console.log("  Categories: Men's Singles, Men's Doubles, Women's Doubles, Mixed Doubles, Special");
    console.log('  Login: admin@courtmastr.com / admin123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
