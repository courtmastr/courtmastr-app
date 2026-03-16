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

    console.log('\n[2] Setting up organizations...');

    // Demo Club — for organizer@courtmastr.com and generic seed tournaments
    const demoOrgId = await createSeedOrg(db, adminId, {
      name: 'CourtMastr Demo Club',
      slug: 'demo-club',
    });
    await setDoc(doc(db, 'organizations', demoOrgId, 'members', organizerId), {
      uid: organizerId,
      role: 'organizer',
      joinedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, 'users', organizerId), { activeOrgId: demoOrgId, updatedAt: serverTimestamp() }, { merge: true });
    console.log(`  demo-club org: ${demoOrgId}`);

    // MCIA org — for mcia-organizer@courtmastr.com
    const mciaOrganizerId = await createOrSignIn(auth, db, {
      email: 'mcia-organizer@courtmastr.com',
      password: 'mcia123',
      displayName: 'MCIA Organizer',
      role: 'organizer',
    });
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');
    const mciaOrgId = await createSeedOrg(db, adminId, {
      name: 'MCIA - McLean County Indian Association',
      slug: 'mcia',
    });
    await setDoc(doc(db, 'organizations', mciaOrgId, 'members', mciaOrganizerId), {
      uid: mciaOrganizerId,
      role: 'organizer',
      joinedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, 'users', mciaOrganizerId), { activeOrgId: mciaOrgId, updatedAt: serverTimestamp() }, { merge: true });
    console.log(`  mcia org: ${mciaOrgId}`);

    // Admin has no activeOrgId — sees all tournaments
    await setDoc(doc(db, 'users', adminId), { activeOrgId: null, updatedAt: serverTimestamp() }, { merge: true });

    console.log('\n[3] Seeding default tournament dataset (demo-club)...');
    await runSeed(db, adminId, demoOrgId);

    console.log('\n[4] Seeding MCIA Badminton 2026 dataset...');
    const mciaTournamentId = await runMCIA2026Seed({
      db,
      adminId,
      orgId: mciaOrgId,
      tournamentName: 'MCIA Badminton 2026',
      startDateOffset: 7,
    });

    console.log(`\n  Demo Club org:      ${demoOrgId}  (/demo-club)`);
    console.log(`  MCIA org:           ${mciaOrgId}  (/mcia)`);
    console.log(`  MCIA tournament ID: ${mciaTournamentId}`);
    console.log('\n  Credentials:');
    console.log('    admin@courtmastr.com / admin123          → sees ALL tournaments');
    console.log('    organizer@courtmastr.com / org123        → demo-club only');
    console.log('    mcia-organizer@courtmastr.com / mcia123  → MCIA only');
    console.log('    scorekeeper@courtmastr.com / score123    → scorekeeper');
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
