/**
 * Production seed — targets the real Firebase project.
 *
 * Test data is defined in core.ts (shared with local.ts).
 * Only Firebase connection and auth setup live here.
 *
 * Run: npm run seed:prod
 *
 * Users (admin + scorekeeper) are created automatically on first run
 * if they don't already exist.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { runSeed } from './core';

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

interface UserConfig {
  email: string;
  password: string;
  displayName: string;
  role: string;
}

async function createOrSignIn(config: UserConfig): Promise<string> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, config.email, config.password);
    await setDoc(doc(db, 'users', user.uid), {
      email: config.email,
      displayName: config.displayName,
      role: config.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  Created ${config.role}: ${config.email}`);
    return user.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/email-already-in-use') {
      const { user } = await signInWithEmailAndPassword(auth, config.email, config.password);
      await setDoc(
        doc(db, 'users', user.uid),
        { email: config.email, displayName: config.displayName, role: config.role, updatedAt: serverTimestamp() },
        { merge: true }
      );
      console.log(`  Found existing ${config.role}: ${config.email}`);
      return user.uid;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(64));
  console.log('  Seed: Production Firebase');
  console.log('='.repeat(64));
  console.log('\n  WARNING: writing to the REAL database.');
  console.log('  Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    console.log('\n[1] Setting up users...');
    const adminId = await createOrSignIn({
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });
    await createOrSignIn({
      email: 'scorekeeper@courtmastr.com',
      password: 'score123',
      displayName: 'Court Scorekeeper',
      role: 'scorekeeper',
    });

    await runSeed(db, adminId);
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
