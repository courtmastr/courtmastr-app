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
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
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

async function setupAdmin(): Promise<string> {
  const email = 'admin@courtmastr.com';
  const password = 'admin123';

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', user.uid), {
      email,
      displayName: 'Tournament Admin',
      role: 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('  Created admin user');
    return user.uid;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/email-already-in-use') {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await setDoc(
        doc(db, 'users', user.uid),
        { email, displayName: 'Tournament Admin', role: 'admin', updatedAt: serverTimestamp() },
        { merge: true }
      );
      console.log('  Signed in as existing admin');
      return user.uid;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(64));
  console.log('  Seed: Local Emulator');
  console.log('='.repeat(64));

  try {
    console.log('\n[1] Setting up admin user...');
    const adminId = await setupAdmin();
    await runSeed(db, adminId);
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
