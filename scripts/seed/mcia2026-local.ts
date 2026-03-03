/**
 * MCIA 2026 Local Seed
 *
 * Seeds the MCIA Badminton 2026 tournament to Firebase emulators.
 * Run: npm run seed:mcia2026:local
 * Requires: emulators running (npm run emulators)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { createOrSignIn } from './helpers';
import { runMCIA2026Seed } from './mcia2026-core';

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
});

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(64));
  console.log('  Seed: MCIA Badminton 2026 (Local Emulator)');
  console.log('='.repeat(64));

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

    console.log('\n[2] Seeding MCIA 2026 tournament...');
    const tournamentId = await runMCIA2026Seed({
      db,
      adminId,
      tournamentName: 'MCIA Badminton 2026',
      startDateOffset: 7,
    });

    console.log('\n' + '='.repeat(64));
    console.log('  MCIA 2026 seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  Tournament ID: ${tournamentId}`);
    console.log("  Category: Men's Doubles (pool_to_elimination)");
    console.log('  Login: admin@courtmastr.com / admin123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
