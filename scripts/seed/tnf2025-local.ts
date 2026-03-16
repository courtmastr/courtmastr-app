/**
 * TNF 2025 Local Seed
 *
 * Seeds the 2025_Tnf tournament to the Firebase emulators.
 * Run: npm run seed:tnf2025:local
 * Requires: emulators running (npm run emulators)
 *
 * Requires: Central Illinois Badminton.xlsx file in project root
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { createOrSignIn, createSeedOrg } from './helpers';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { runTNF2025Seed } from './tnf2025-core';

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
  console.log('  Seed: TNF 2025 Tournament (Local Emulator)');
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

    // Re-authenticate as admin for org + tournament writes
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Setting up TNF org...');
    const tnfOrgId = await createSeedOrg(db, adminId, {
      name: 'Tamilnadu Foundation (TNF)',
      slug: 'tnf',
    });
    await setDoc(doc(db, 'organizations', tnfOrgId, 'members', tnfOrganizerId), {
      uid: tnfOrganizerId,
      role: 'organizer',
      joinedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, 'users', tnfOrganizerId), { activeOrgId: tnfOrgId, updatedAt: serverTimestamp() }, { merge: true });
    console.log(`  TNF org: ${tnfOrgId}  (/tnf)`);

    console.log('\n[3] Seeding TNF 2025 tournament...');
    const tournamentId = await runTNF2025Seed({
      db,
      adminId,
      orgId: tnfOrgId,
      tournamentName: '2025_Tnf',
      startDateOffset: 14,
    });

    console.log('\n' + '='.repeat(64));
    console.log('  TNF 2025 Seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  TNF Org ID:    ${tnfOrgId}  (/tnf)`);
    console.log(`  Tournament ID: ${tournamentId}`);
    console.log("  Categories: Men's Singles, Men's Doubles, Women's Doubles, Mixed Doubles, Special");
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
