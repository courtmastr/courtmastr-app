/**
 * Production seed — targets the real Firebase project.
 *
 * Test data is defined in core.ts (shared with local.ts).
 * Only Firebase connection and auth setup live here.
 *
 * Run: npm run seed:prod
 *
 * Prerequisites:
 *   1. Create admin@courtmastr.com / admin123 in Firebase Console
 *      → Authentication > Users > Add user
 *   2. Add a Firestore doc at users/<uid>:
 *      { email, displayName: "Tournament Admin", role: "admin" }
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

async function signInAdmin(): Promise<string> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
    console.log('  Signed in as admin');
    return user.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      console.error('\n  Admin user not found. Create it first:');
      console.error('  Firebase Console → Authentication → Users → Add user');
      console.error('  Email: admin@courtmastr.com  Password: admin123');
      console.error('  Then add Firestore doc at users/<uid> with role: "admin".');
      process.exit(1);
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
    console.log('\n[1] Signing in as admin...');
    const adminId = await signInAdmin();
    await runSeed(db, adminId);
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
