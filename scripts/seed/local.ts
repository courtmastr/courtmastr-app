/**
 * Local seed — targets Firebase emulators.
 *
 * Test data is defined in core.ts (shared with production.ts).
 * Only Firebase connection and auth setup live here.
 *
 * Run: npm run seed:local
 * Requires: emulators running (npm run emulators)
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { createOrSignIn } from './helpers';
import { runSeed } from './core';

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
  console.log('  Seed: Local Emulator');
  console.log('='.repeat(64));

  try {
    console.log('\n[1] Setting up users...');
    const adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });
    await createOrSignIn(auth, db, {
      email: 'scorekeeper@courtmastr.com',
      password: 'score123',
      displayName: 'Court Scorekeeper',
      role: 'scorekeeper',
    });

    // Re-authenticate as admin — createOrSignIn leaves auth as the last signed-in
    // user (scorekeeper), but runSeed must write as admin to satisfy Firestore rules.
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    await runSeed(db, adminId);
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
