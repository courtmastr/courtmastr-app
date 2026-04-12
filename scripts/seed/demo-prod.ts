/**
 * CourtMastr Demo Seed - Production
 *
 * Seeds only the dedicated /demo organization and CourtMastr Feature Demo
 * tournament into the production Firebase project.
 *
 * Run:
 *   COURTMASTR_SEED_OPERATOR_EMAIL=...
 *   COURTMASTR_SEED_OPERATOR_PASSWORD=...
 *   COURTMASTR_DEMO_ORGANIZER_PASSWORD=...
 *   npm run seed:demo:prod
 */

import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import {
  DEMO_ORG_SLUG,
  DEMO_ORGANIZER_EMAIL,
  DEMO_TOURNAMENT_NAME,
  initializeDemoFirebaseApp,
  resolveDemoProdEnv,
  runDemoSeed,
  signInSeedOperator,
} from './demo-core';

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(64)}`);
  console.log('  Seed: CourtMastr Demo (Production)');
  console.log('='.repeat(64));
  console.log('\n  WARNING: Writing demo-scoped records to the REAL production database.');
  console.log('  Scope: /demo org, CourtMastr Feature Demo tournament, demo users, and demo player identity records only.');
  console.log('  Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    const env = resolveDemoProdEnv();
    const app = initializeDemoFirebaseApp('production');
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app);
    const operator = await signInSeedOperator(
      auth,
      db,
      env.operatorEmail,
      env.operatorPassword,
    );

    const result = await runDemoSeed({
      db,
      auth,
      functions,
      operator,
      operatorPassword: env.operatorPassword,
      demoOrganizerPassword: env.demoOrganizerPassword,
      volunteerPins: {
        checkin: env.checkinPin,
        scorekeeper: env.scorekeeperPin,
      },
    });

    console.log(`\n${'='.repeat(64)}`);
    console.log('  Production demo seed completed successfully');
    console.log('='.repeat(64));
    console.log(`\n  Org ID:        ${result.orgId}  (/${DEMO_ORG_SLUG})`);
    console.log(`  Tournament:    ${DEMO_TOURNAMENT_NAME}`);
    console.log(`  Tournament ID: ${result.tournamentId}`);
    console.log(`  Created new:   ${result.createdTournament ? 'yes' : 'no, existing demo tournament reused'}`);
    console.log(`  Demo login:    ${DEMO_ORGANIZER_EMAIL} / <COURTMASTR_DEMO_ORGANIZER_PASSWORD>`);
    console.log(`  Volunteer PINs configured: ${result.volunteerPinsConfigured.join(', ') || 'none'}`);
    console.log('\n  Public page: /demo');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\nProduction demo seed failed:', error);
    process.exit(1);
  }
}

main();
