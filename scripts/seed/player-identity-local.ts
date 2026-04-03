import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { createOrSignIn } from './helpers';
import { runPlayerIdentitySeed } from './player-identity-core';

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
  console.log('  Seed: Player Identity Merge Lab (Local Emulator)');
  console.log('='.repeat(64));

  try {
    const adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });

    const result = await runPlayerIdentitySeed(db, adminId);

    console.log('\nSeed completed successfully.');
    console.log(`Org ID:          ${result.orgId}`);
    console.log(`Tournament ID:   ${result.tournamentId}`);
    console.log(`Singles Cat ID:  ${result.singlesCategoryId}`);
    console.log(`Doubles Cat ID:  ${result.doublesCategoryId}`);
    console.log('\nManual test cases:');
    console.log(`1. Primary merge success`);
    console.log(`   source: ${result.cases.primaryMerge.sourcePlayerId}`);
    console.log(`   target: ${result.cases.primaryMerge.targetPlayerId}`);
    console.log(`   route:  ${result.cases.primaryMerge.route}`);
    console.log(`2. Partner repoint success`);
    console.log(`   source: ${result.cases.partnerMerge.sourcePlayerId}`);
    console.log(`   target: ${result.cases.partnerMerge.targetPlayerId}`);
    console.log(`   route:  ${result.cases.partnerMerge.route}`);
    console.log(`3. Same-team guard rejection`);
    console.log(`   source: ${result.cases.sameTeamGuard.sourcePlayerId}`);
    console.log(`   target: ${result.cases.sameTeamGuard.targetPlayerId}`);
    console.log(`   route:  ${result.cases.sameTeamGuard.route}`);
    console.log(`4. Inactive-target guard rejection`);
    console.log(`   source: ${result.cases.inactiveTargetGuard.sourcePlayerId}`);
    console.log(`   target: ${result.cases.inactiveTargetGuard.targetPlayerId}`);
    console.log(`   route:  ${result.cases.inactiveTargetGuard.route}`);
    console.log('\nCredentials: admin@courtmastr.com / admin123');
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
