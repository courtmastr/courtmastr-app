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
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { createOrSignIn, createSeedOrg } from './helpers';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { runSeed } from './core';
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
    const organizerId = await createOrSignIn(auth, db, {
      email: 'organizer@courtmastr.com',
      password: 'org123',
      displayName: 'Org Organizer',
      role: 'organizer',
    });
    await createOrSignIn(auth, db, {
      email: 'scorekeeper@courtmastr.com',
      password: 'score123',
      displayName: 'Court Scorekeeper',
      role: 'scorekeeper',
    });

    // Re-authenticate as admin — createOrSignIn leaves auth as the last signed-in
    // user (scorekeeper), but subsequent writes must be as admin.
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Setting up seed organization...');
    const orgId = await createSeedOrg(db, adminId, {
      name: 'CourtMastr Demo Club',
      slug: 'demo-club',
    });
    // Add organizer as org member
    await setDoc(doc(db, 'organizations', orgId, 'members', organizerId), {
      uid: organizerId,
      role: 'organizer',
      joinedAt: serverTimestamp(),
    }, { merge: true });
    // Set activeOrgId on both admin and organizer
    await setDoc(doc(db, 'users', adminId), { activeOrgId: orgId, updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, 'users', organizerId), { activeOrgId: orgId, updatedAt: serverTimestamp() }, { merge: true });
    console.log(`  Linked admin + organizer to org ${orgId}`);

    console.log('\n[3] Seeding default tournament dataset...');
    await runSeed(db, adminId, orgId);

    console.log('\n[4] Seeding MCIA Badminton 2026 dataset...');
    const mciaTournamentId = await runMCIA2026Seed({
      db,
      adminId,
      orgId,
      tournamentName: 'MCIA Badminton 2026',
      startDateOffset: 7,
    });

    console.log(`\n  Org ID:             ${orgId}`);
    console.log(`  Public org page:    /demo-club`);
    console.log(`  MCIA tournament ID: ${mciaTournamentId}`);
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
