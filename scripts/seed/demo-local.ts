/**
 * CourtMastr Demo Seed - Local Emulator
 *
 * Run: npm run seed:demo:local
 * Requires: emulators running (npm run emulators)
 *
 * Creates two tournaments:
 *
 * 1) CourtMastr Feature Demo  — full multi-category demo (existing)
 *    - Men's Singles (single_elimination, 15 players)
 *    - Men's Doubles (pool_to_elimination, 23 players, POOLS COMPLETE — banner shows)
 *    - Mixed Doubles (double_elimination, 13 players)
 *
 * 2) Pool Cut Showcase  — minimal 3×4 scenario for "Advance to Elimination" testing
 *    - Men's Singles (pool_to_elimination, 12 players, 3 pools × 4)
 *    - All pool matches completed → "Advance to Elimination" banner immediately visible
 *    - No elimination bracket generated → director can test the dialog
 */

import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  connectDemoFunctionsEmulator,
  createLocalSeedOperator,
  DEMO_ORG_SLUG,
  DEMO_ORGANIZER_EMAIL,
  DEMO_TOURNAMENT_NAME,
  initializeDemoFirebaseApp,
  runDemoSeed,
} from './demo-core';
import { seedGlobalPlayer } from './helpers';

const app = initializeDemoFirebaseApp('local');
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);
const functions = connectDemoFunctionsEmulator(app);

// ─── Pool Cut Showcase ────────────────────────────────────────────────────────
//
// 3 pools × 4 players = 12 total. All pool matches completed using a
// deterministic winner pattern (lower seed wins). Pool completed at is set so
// the "Advance to Elimination" banner appears immediately on the categories page.

const SHOWCASE_TOURNAMENT_ID = 'demo-pool-cut-showcase';
const SHOWCASE_CATEGORY_ID   = 'demo-pcs-category';
const SHOWCASE_ORG_ID        = 'demo-pcs-org';
const SHOWCASE_POOL_STAGE_ID = '10';
const SHOWCASE_BASE_DATE     = new Date('2026-04-15T09:00:00.000Z');
const SHOWCASE_START         = Timestamp.fromDate(SHOWCASE_BASE_DATE);
const SHOWCASE_END           = Timestamp.fromDate(new Date('2026-04-15T18:00:00.000Z'));

interface ShowcasePlayer {
  id: string;
  registrationId: string;
  participantId: number;
  firstName: string;
  lastName: string;
  groupId: string;
  /** 1 = pool winner (beats all in pool), 4 = last (loses all). */
  poolRank: number;
}

const SHOWCASE_PLAYERS: ShowcasePlayer[] = [
  // Pool A (group '1') — Alpha wins all, Delta loses all
  { id: 'pcs-p01', registrationId: 'reg-pcs-01', participantId: 1,  firstName: 'Alpha',   lastName: 'Ace',     groupId: '1', poolRank: 1 },
  { id: 'pcs-p02', registrationId: 'reg-pcs-02', participantId: 2,  firstName: 'Bravo',   lastName: 'Bold',    groupId: '1', poolRank: 2 },
  { id: 'pcs-p03', registrationId: 'reg-pcs-03', participantId: 3,  firstName: 'Charlie', lastName: 'Cross',   groupId: '1', poolRank: 3 },
  { id: 'pcs-p04', registrationId: 'reg-pcs-04', participantId: 4,  firstName: 'Delta',   lastName: 'Drake',   groupId: '1', poolRank: 4 },
  // Pool B (group '2') — Echo wins all, Hotel loses all
  { id: 'pcs-p05', registrationId: 'reg-pcs-05', participantId: 5,  firstName: 'Echo',    lastName: 'Edge',    groupId: '2', poolRank: 1 },
  { id: 'pcs-p06', registrationId: 'reg-pcs-06', participantId: 6,  firstName: 'Foxtrot', lastName: 'Ford',    groupId: '2', poolRank: 2 },
  { id: 'pcs-p07', registrationId: 'reg-pcs-07', participantId: 7,  firstName: 'Golf',    lastName: 'Grant',   groupId: '2', poolRank: 3 },
  { id: 'pcs-p08', registrationId: 'reg-pcs-08', participantId: 8,  firstName: 'Hotel',   lastName: 'Hart',    groupId: '2', poolRank: 4 },
  // Pool C (group '3') — India wins all, Lima loses all
  { id: 'pcs-p09', registrationId: 'reg-pcs-09', participantId: 9,  firstName: 'India',   lastName: 'Irons',   groupId: '3', poolRank: 1 },
  { id: 'pcs-p10', registrationId: 'reg-pcs-10', participantId: 10, firstName: 'Juliet',  lastName: 'James',   groupId: '3', poolRank: 2 },
  { id: 'pcs-p11', registrationId: 'reg-pcs-11', participantId: 11, firstName: 'Kilo',    lastName: 'Kane',    groupId: '3', poolRank: 3 },
  { id: 'pcs-p12', registrationId: 'reg-pcs-12', participantId: 12, firstName: 'Lima',    lastName: 'Lane',    groupId: '3', poolRank: 4 },
];

async function seedPoolCutShowcase(adminId: string): Promise<void> {
  console.log('\n  Seeding Pool Cut Showcase tournament…');

  const emailCache = new Map<string, string>();
  const batch = writeBatch(db);

  // Org
  batch.set(doc(db, 'orgSlugIndex', 'demo-pcs'), { orgId: SHOWCASE_ORG_ID, createdAt: SHOWCASE_START });
  batch.set(doc(db, 'organizations', SHOWCASE_ORG_ID), {
    id: SHOWCASE_ORG_ID, name: 'Pool Cut Showcase Club', slug: 'demo-pcs',
    contactEmail: 'admin@courtmastr.com', timezone: 'America/Chicago',
    createdAt: SHOWCASE_START, updatedAt: SHOWCASE_END,
  });
  batch.set(doc(db, `organizations/${SHOWCASE_ORG_ID}/members/${adminId}`), {
    uid: adminId, role: 'admin', joinedAt: SHOWCASE_START,
  });

  // Tournament
  batch.set(doc(db, 'tournaments', SHOWCASE_TOURNAMENT_ID), {
    name: 'Pool Cut Showcase',
    description: 'Demo tournament showing the Pool Cut & Advance to Elimination feature. All 12 pool matches are complete — click "Advance to Elimination" on the category to open the bracket dialog.',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'Demo Arena — Court 1',
    startDate: SHOWCASE_START,
    endDate: SHOWCASE_END,
    orgId: SHOWCASE_ORG_ID,
    createdBy: adminId,
    organizerIds: [adminId],
    settings: {
      minRestTimeMinutes: 15, matchDurationMinutes: 20,
      allowSelfRegistration: false, requireApproval: false,
      gamesPerMatch: 3, pointsToWin: 21, mustWinBy: 2, maxPoints: 30,
      rankingPresetDefault: 'courtmaster_default',
      progressionModeDefault: 'carry_forward',
    },
    createdAt: SHOWCASE_START,
    updatedAt: SHOWCASE_END,
  });

  // Category — pools complete, no elimination bracket
  batch.set(doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}`), {
    tournamentId: SHOWCASE_TOURNAMENT_ID,
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: 'pool_to_elimination',
    status: 'active',
    seedingEnabled: false,
    poolStageId: Number(SHOWCASE_POOL_STAGE_ID),
    poolGroupCount: 3,
    teamsPerPool: 4,
    poolQualifiersPerGroup: 2,
    poolCompletedAt: SHOWCASE_END, // triggers banner
    // No eliminationStageId → "Advance to Elimination" button visible
    checkInOpen: false,
    createdAt: SHOWCASE_START,
    updatedAt: SHOWCASE_END,
  });

  // Pool stage (required by AdvanceToEliminationDialog's generatePreview)
  batch.set(
    doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}/stage/${SHOWCASE_POOL_STAGE_ID}`),
    { id: SHOWCASE_POOL_STAGE_ID, name: 'Pool Stage', type: 'round_robin', tournament_id: SHOWCASE_CATEGORY_ID, settings: { groupCount: 3 } },
  );

  // Group docs (3 pools labelled Pool 1 / 2 / 3)
  for (let g = 1; g <= 3; g++) {
    batch.set(
      doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}/group/${g}`),
      { id: String(g), number: g, stage_id: SHOWCASE_POOL_STAGE_ID },
    );
  }

  // Players, registrations, bracket-manager participants
  for (const player of SHOWCASE_PLAYERS) {
    const globalPlayerId = await seedGlobalPlayer(db, SHOWCASE_TOURNAMENT_ID, {
      firstName: player.firstName,
      lastName: player.lastName,
      email: `${player.id}@demo-pcs.courtmastr.local`,
      phone: `555-${String(player.participantId).padStart(4, '0')}`,
      gender: 'male',
      skillLevel: 5 - player.poolRank, // rank 1 = skill 4, rank 4 = skill 1
    }, emailCache);

    batch.set(doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/registrations/${player.registrationId}`), {
      tournamentId: SHOWCASE_TOURNAMENT_ID,
      categoryId: SHOWCASE_CATEGORY_ID,
      participantType: 'player',
      playerId: globalPlayerId,
      status: 'checked_in',
      isCheckedIn: true,
      seed: player.participantId,
      registeredBy: adminId,
      registeredAt: SHOWCASE_START,
      checkedInAt: SHOWCASE_START,
      createdAt: SHOWCASE_START,
      updatedAt: SHOWCASE_START,
    });

    batch.set(
      doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}/participant/${player.participantId}`),
      { id: String(player.participantId), tournament_id: SHOWCASE_CATEGORY_ID, name: player.registrationId },
    );
  }

  // Pool matches — 6 per pool (round-robin), lower poolRank always wins 21-15
  const groups = ['1', '2', '3'];
  for (const gid of groups) {
    const poolPlayers = SHOWCASE_PLAYERS.filter((p) => p.groupId === gid);
    for (let i = 0; i < poolPlayers.length; i++) {
      for (let j = i + 1; j < poolPlayers.length; j++) {
        const p1 = poolPlayers[i];
        const p2 = poolPlayers[j];
        const winner = p1.poolRank < p2.poolRank ? p1 : p2;
        const matchId = `pcs-g${gid}-${i}-${j}`;

        // Bracket-manager match (read by generatePreview for rankings)
        batch.set(
          doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}/match/${matchId}`),
          {
            stage_id: SHOWCASE_POOL_STAGE_ID, group_id: gid, round: 1,
            number: i * poolPlayers.length + j, status: 4,
            opponent1: { id: String(p1.participantId), result: winner === p1 ? 'win' : 'loss' },
            opponent2: { id: String(p2.participantId), result: winner === p2 ? 'win' : 'loss' },
          },
        );

        // Match scores (operational data for matchStore)
        batch.set(
          doc(db, `tournaments/${SHOWCASE_TOURNAMENT_ID}/categories/${SHOWCASE_CATEGORY_ID}/match_scores/${matchId}`),
          {
            tournamentId: SHOWCASE_TOURNAMENT_ID, categoryId: SHOWCASE_CATEGORY_ID, groupId: gid,
            participant1Id: p1.registrationId, participant2Id: p2.registrationId,
            winnerId: winner.registrationId, status: 'completed',
            scores: [{
              gameNumber: 1,
              score1: winner === p1 ? 21 : 15, score2: winner === p2 ? 21 : 15,
              winnerId: winner.registrationId, isComplete: true,
            }],
            completedAt: SHOWCASE_END, updatedAt: SHOWCASE_END,
          },
        );
      }
    }
  }

  await batch.commit();
  console.log('  Pool Cut Showcase seeded successfully');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

    // Seed the dedicated Pool Cut Showcase (uses operator/admin account)
    await seedPoolCutShowcase(operator.uid);

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
    console.log('  ─── Pool Cut & Advance to Elimination Demo ───────────────');
    console.log(`  Tournament ID: ${SHOWCASE_TOURNAMENT_ID}`);
    console.log(`  URL:           /tournaments/${SHOWCASE_TOURNAMENT_ID}/categories`);
    console.log('  Scenario:      3 pools × 4 players = 12 total, all matches done');
    console.log('  Action:        Click "Advance to Elimination" on Men\'s Singles');
    console.log('  Dialog N=8:    Single Elimination (perfect bracket)');
    console.log('  Dialog N=12:   Double Elimination (non-bracket size)');
    console.log('  Quick picks:   2, 4, 8, All');
    console.log('  Login:         admin@courtmastr.com / admin123');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\nDemo seed failed:', error);
    process.exit(1);
  }
}

main();
