/**
 * CourtMastr Demo Seed - Local Emulator
 *
 * Run: npm run seed:demo:local
 * Requires: emulators running (npm run emulators)
 */

import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import {
  connectDemoFunctionsEmulator,
  createLocalSeedOperator,
  DEMO_ORG_SLUG,
  DEMO_ORGANIZER_EMAIL,
  DEMO_TOURNAMENT_NAME,
  initializeDemoFirebaseApp,
  runDemoSeed,
} from './demo-core';

const app = initializeDemoFirebaseApp('local');
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);
const functions = connectDemoFunctionsEmulator(app);

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(64)}`);
  console.log('  Seed: CourtMastr Demo (Local Emulator)');
  console.log('='.repeat(64));

  try {
    const operator = await createLocalSeedOperator(auth, db);
    const result = await runDemoSeed({
      db,
      auth,
      functions,
      operator,
      operatorPassword: 'admin123',
      demoOrganizerPassword: 'demo123',
      volunteerPins: {
        checkin: '1111',
        scorekeeper: '2222',
      },
    });

    console.log(`\n${'='.repeat(64)}`);
    console.log('  Demo seed completed successfully');
    console.log('='.repeat(64));
    console.log(`\n  Org ID:        ${result.orgId}  (/${DEMO_ORG_SLUG})`);
    console.log(`  Tournament:    ${DEMO_TOURNAMENT_NAME}`);
    console.log(`  Tournament ID: ${result.tournamentId}`);
    console.log(`  Created new:   ${result.createdTournament ? 'yes' : 'no, existing demo tournament reused'}`);
    console.log(`  Login:         ${DEMO_ORGANIZER_EMAIL} / demo123`);
    console.log('  Check-in PIN:  1111');
    console.log('  Scoring PIN:   2222');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\nDemo seed failed:', error);
    process.exit(1);
  }
}

main();
