/**
 * Test Match Utilities
 * Quick scripts to test match scoring and bracket progression
 *
 * Run with: npx ts-node scripts/test-match.ts <command> [args]
 *
 * Commands:
 *   complete <tournamentId> <matchId> <winnerId>  - Complete a match with winner
 *   score <tournamentId> <matchId> <p1Score> <p2Score> - Set game score
 *   list <tournamentId> [categoryId]              - List matches
 *   ready <tournamentId>                          - List ready-to-play matches
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

// Firebase config for emulator
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);
connectFirestoreEmulator(db, 'localhost', 8080);
connectFunctionsEmulator(functions, 'localhost', 5001);

interface MatchData {
  opponent1?: { id?: number | string };
  opponent2?: { id?: number | string };
  status?: number;
  number?: number;
  stage_id?: string;
}

interface ScoreData {
  status?: string;
  scores?: Array<{ game: number; player1: number; player2: number }>;
}

async function completeMatch(tournamentId: string, matchId: string, winnerId: string) {
  const matchRef = doc(db, `tournaments/${tournamentId}/match`, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    console.error('Match not found in /match collection');
    return;
  }

  const match = matchDoc.data() as MatchData;
  const opponent1Id = match.opponent1?.id;
  const opponent2Id = match.opponent2?.id;

  const isOpponent1Winner = String(opponent1Id) === winnerId;
  const isOpponent2Winner = String(opponent2Id) === winnerId;

  if (!isOpponent1Winner && !isOpponent2Winner) {
    console.error('Winner ID does not match either opponent');
    return;
  }

  const scoreRef = doc(db, `tournaments/${tournamentId}/match_scores`, matchId);
  await setDoc(scoreRef, {
    status: 'completed',
    winnerId,
    scores: [
      { game: 1, player1: 21, player2: 15 },
      { game: 2, player1: 21, player2: 18 },
    ],
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log(`✅ Match ${matchId} completed. Winner: ${winnerId}`);

  try {
    const advanceWinner = httpsCallable(functions, 'advanceWinner');
    await advanceWinner({
      tournamentId,
      matchId,
      winnerId,
    });
    console.log(`   → Winner advanced via brackets-manager`);
  } catch (error) {
    console.error(`   ⚠️  Failed to advance winner:`, error);
  }
}

async function setScore(tournamentId: string, matchId: string, p1Score: number, p2Score: number) {
  const scoreRef = doc(db, `tournaments/${tournamentId}/match_scores`, matchId);

  await setDoc(scoreRef, {
    status: 'in_progress',
    scores: [
      { game: 1, player1: p1Score, player2: p2Score },
    ],
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log(`✅ Match ${matchId} score set to ${p1Score}-${p2Score}`);
}

async function listMatches(tournamentId: string, categoryId?: string) {
  let q;
  if (categoryId) {
    q = query(
      collection(db, `tournaments/${tournamentId}/match`),
      where('stage_id', '==', categoryId),
      orderBy('number')
    );
  } else {
    q = query(
      collection(db, `tournaments/${tournamentId}/match`),
      orderBy('number')
    );
  }

  const snapshot = await getDocs(q);

  const scoresSnapshot = await getDocs(
    collection(db, `tournaments/${tournamentId}/match_scores`)
  );
  const scoresMap = new Map<string, ScoreData>(scoresSnapshot.docs.map(d => [d.id, d.data() as ScoreData]));

  console.log('\n📋 Matches:');
  console.log('─'.repeat(100));
  console.log(`${'ID'.padEnd(24)} ${'#'.padEnd(4)} ${'Status'.padEnd(12)} ${'Opponent 1'.padEnd(24)} ${'Opponent 2'.padEnd(24)}`);
  console.log('─'.repeat(100));

  for (const doc of snapshot.docs) {
    const m = doc.data() as MatchData;
    const scoreData = scoresMap.get(doc.id);

    let status = 'unknown';
    if (scoreData?.status) {
      status = scoreData.status;
    } else {
      const bmStatus = m.status;
      if (bmStatus === 0 || bmStatus === 1) status = 'scheduled';
      else if (bmStatus === 2) status = 'ready';
      else if (bmStatus === 3) status = 'in_progress';
      else if (bmStatus === 4) status = 'completed';
    }

    const o1 = m.opponent1?.id ? String(m.opponent1.id).slice(0, 20) : 'TBD';
    const o2 = m.opponent2?.id ? String(m.opponent2.id).slice(0, 20) : 'TBD';

    console.log(
      `${doc.id.padEnd(24)} ` +
      `${String(m.number).padEnd(4)} ` +
      `${status.padEnd(12)} ` +
      `${o1.padEnd(24)} ` +
      `${o2.padEnd(24)}`
    );
  }

  console.log('─'.repeat(100));
  console.log(`Total: ${snapshot.docs.length} matches\n`);
}

async function listReadyMatches(tournamentId: string) {
  const q = query(
    collection(db, `tournaments/${tournamentId}/match`),
    where('status', '==', 2),
    orderBy('number')
  );

  const snapshot = await getDocs(q);

  const readyMatches = snapshot.docs.filter(doc => {
    const m = doc.data() as MatchData;
    return m.opponent1?.id != null && m.opponent2?.id != null;
  });

  console.log('\n🎯 Ready to Play:');
  console.log('─'.repeat(80));

  for (const doc of readyMatches) {
    const m = doc.data() as MatchData;
    console.log(`  Match #${m.number} (${doc.id})`);
    console.log(`    O1: ${m.opponent1?.id}`);
    console.log(`    O2: ${m.opponent2?.id}`);
    console.log(`    Status: ready | Stage: ${m.stage_id}`);
    console.log('');
  }

  console.log(`Total: ${readyMatches.length} ready matches\n`);

  if (readyMatches.length > 0) {
    const first = readyMatches[0];
    const m = first.data() as MatchData;
    console.log('Quick complete (copy/paste):');
    console.log(`  npx ts-node scripts/test-match.ts complete ${tournamentId} ${first.id} ${m.opponent1?.id}`);
    console.log(`  npx ts-node scripts/test-match.ts complete ${tournamentId} ${first.id} ${m.opponent2?.id}`);
  }
}

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'complete':
      if (args.length < 3) {
        console.error('Usage: complete <tournamentId> <matchId> <winnerId>');
        process.exit(1);
      }
      await completeMatch(args[0], args[1], args[2]);
      break;

    case 'score':
      if (args.length < 4) {
        console.error('Usage: score <tournamentId> <matchId> <p1Score> <p2Score>');
        process.exit(1);
      }
      await setScore(args[0], args[1], parseInt(args[2]), parseInt(args[3]));
      break;

    case 'list':
      if (args.length < 1) {
        console.error('Usage: list <tournamentId> [categoryId]');
        process.exit(1);
      }
      await listMatches(args[0], args[1]);
      break;

    case 'ready':
      if (args.length < 1) {
        console.error('Usage: ready <tournamentId>');
        process.exit(1);
      }
      await listReadyMatches(args[0]);
      break;

    default:
      console.log(`
Test Match Utilities
====================

Commands:
  complete <tournamentId> <matchId> <winnerId>    Complete a match with a winner
  score <tournamentId> <matchId> <p1> <p2>        Set current game score
  list <tournamentId> [categoryId]                List all matches
  ready <tournamentId>                            List matches ready to play

Examples:
  npx ts-node scripts/test-match.ts list H59OUMOmC8qGXpp5SO31
  npx ts-node scripts/test-match.ts ready H59OUMOmC8qGXpp5SO31
  npx ts-node scripts/test-match.ts complete H59OUMOmC8qGXpp5SO31 <matchId> <winnerId>
      `);
  }

  process.exit(0);
}

main().catch(console.error);
