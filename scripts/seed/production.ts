/**
 * Production seed — TNF 2026 only.
 *
 * Run: npm run seed:prod
 *
 * This now mirrors the TNF-specific production seed path:
 * - creates or reuses admin and TNF organizer users
 * - creates or reuses the TNF organization
 * - seeds the TNF workbook-backed tournament into production
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { createOrSignIn, createSeedOrg } from './helpers';
import {
  runTNF2026Seed,
  TNF_2026_ORG_NAME,
  TNF_2026_ORG_SLUG,
} from './tnf2026-core';

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
  console.log(`\n${'='.repeat(64)}`);
  console.log('  Seed: TNF 2026 Tournament (Production)');
  console.log('='.repeat(64));
  console.log('\n  WARNING: Writing to the REAL production database.');
  console.log('  Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

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
    console.log(`  TNF org: ${tnfOrgId}  (/${TNF_2026_ORG_SLUG})`);

    console.log('\n[3] Seeding TNF 2026 tournament...');
    const tournamentId = await runTNF2026Seed({
      db,
      adminId,
      orgId: tnfOrgId,
      organizerIds: [tnfOrganizerId],
      startDateOffset: 11,
    });

    console.log(`\n${'='.repeat(64)}`);
    console.log('  TNF 2026 seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  TNF Org ID:    ${tnfOrgId}  (/${TNF_2026_ORG_SLUG})`);
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
