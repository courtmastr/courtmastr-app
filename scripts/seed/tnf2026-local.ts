/**
 * TNF 2026 Local Seed
 *
 * Seeds the TNF 2026 tournament to the Firebase emulators.
 * Run: npm run seed:tnf2026:local
 * Requires: emulators running (npm run emulators)
 */

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { createOrSignIn, createSeedOrg } from './helpers';
import {
  runTNF2026Seed,
  TNF_2026_ORG_NAME,
  TNF_2026_ORG_SLUG,
} from './tnf2026-core';

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
  console.log(`\n${'='.repeat(64)}`);
  console.log('  Seed: TNF 2026 Tournament (Local Emulator)');
  console.log('='.repeat(64));

  try {
    console.log('\n[1] Setting up users...');
    const adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });
    const tnfOrganizerId = await createOrSignIn(auth, db, {
      email: 'tnf-organizer@courtmastr.com',
      password: 'tnf123',
      displayName: 'TNF Organizer',
      role: 'organizer',
    });

    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Setting up TNF org...');
    const tnfOrgId = await createSeedOrg(db, adminId, {
      name: TNF_2026_ORG_NAME,
      slug: TNF_2026_ORG_SLUG,
    });
    await setDoc(
      doc(db, 'organizations', tnfOrgId, 'members', tnfOrganizerId),
      {
        uid: tnfOrganizerId,
        role: 'organizer',
        joinedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await setDoc(
      doc(db, 'users', tnfOrganizerId),
      {
        activeOrgId: tnfOrgId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  TNF org: ${tnfOrgId}  (/tnf)`);

    console.log('\n[3] Seeding TNF 2026 tournament...');
    const tournamentId = await runTNF2026Seed({
      db,
      adminId,
      orgId: tnfOrgId,
      organizerIds: [tnfOrganizerId],
      startDateOffset: 14,
    });

    console.log(`\n${'='.repeat(64)}`);
    console.log('  TNF 2026 seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  TNF Org ID:    ${tnfOrgId}  (/tnf)`);
    console.log(`  Tournament ID: ${tournamentId}`);
    console.log("  Categories: Men's Singles, Men's Doubles, Women's Doubles, Mixed Doubles, Youth Doubles, Kids Doubles");
    console.log('  Login: tnf-organizer@courtmastr.com / tnf123  → TNF only');
    console.log('  Login: admin@courtmastr.com / admin123        → all tournaments');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
