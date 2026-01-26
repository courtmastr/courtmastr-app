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
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Firebase config for emulator
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

async function completeMatch(tournamentId: string, matchId: string, winnerId: string) {
  const matchRef = doc(db, `tournaments/${tournamentId}/matches`, matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    console.error('Match not found');
    return;
  }

  const match = matchDoc.data();
  const loserId = match.participant1Id === winnerId ? match.participant2Id : match.participant1Id;

  // Update match as completed
  await updateDoc(matchRef, {
    status: 'completed',
    winnerId,
    scores: [
      { gameNumber: 1, score1: 21, score2: 15, winnerId, isComplete: true },
      { gameNumber: 2, score1: 21, score2: 18, winnerId, isComplete: true },
    ],
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log(`✅ Match ${matchId} completed. Winner: ${winnerId}`);

  // Advance winner to next match
  if (match.nextMatchId && match.nextMatchSlot) {
    const nextMatchRef = doc(db, `tournaments/${tournamentId}/matches`, match.nextMatchId);
    await updateDoc(nextMatchRef, {
      [`${match.nextMatchSlot}Id`]: winnerId,
      updatedAt: serverTimestamp(),
    });
    console.log(`   → Winner advanced to ${match.nextMatchId} (${match.nextMatchSlot})`);
  }

  // Advance loser to losers bracket (double elim)
  if (match.loserNextMatchId && match.loserNextMatchSlot && loserId) {
    const loserMatchRef = doc(db, `tournaments/${tournamentId}/matches`, match.loserNextMatchId);
    await updateDoc(loserMatchRef, {
      [`${match.loserNextMatchSlot}Id`]: loserId,
      updatedAt: serverTimestamp(),
    });
    console.log(`   → Loser advanced to ${match.loserNextMatchId} (${match.loserNextMatchSlot})`);
  }
}

async function setScore(tournamentId: string, matchId: string, p1Score: number, p2Score: number) {
  const matchRef = doc(db, `tournaments/${tournamentId}/matches`, matchId);

  await updateDoc(matchRef, {
    status: 'in_progress',
    scores: [
      { gameNumber: 1, score1: p1Score, score2: p2Score, isComplete: false },
    ],
    updatedAt: serverTimestamp(),
  });

  console.log(`✅ Match ${matchId} score set to ${p1Score}-${p2Score}`);
}

async function listMatches(tournamentId: string, categoryId?: string) {
  let q;
  if (categoryId) {
    q = query(
      collection(db, `tournaments/${tournamentId}/matches`),
      where('categoryId', '==', categoryId),
      orderBy('round'),
      orderBy('matchNumber')
    );
  } else {
    q = query(
      collection(db, `tournaments/${tournamentId}/matches`),
      orderBy('round'),
      orderBy('matchNumber')
    );
  }

  const snapshot = await getDocs(q);

  console.log('\n📋 Matches:');
  console.log('─'.repeat(100));
  console.log(`${'ID'.padEnd(24)} ${'#'.padEnd(4)} ${'Round'.padEnd(6)} ${'Status'.padEnd(12)} ${'P1'.padEnd(24)} ${'P2'.padEnd(24)} ${'Winner'.padEnd(8)}`);
  console.log('─'.repeat(100));

  for (const doc of snapshot.docs) {
    const m = doc.data();
    const p1 = m.participant1Id?.slice(0, 20) || 'TBD';
    const p2 = m.participant2Id?.slice(0, 20) || 'TBD';
    const winner = m.winnerId ? (m.winnerId === m.participant1Id ? 'P1' : 'P2') : '-';

    console.log(
      `${doc.id.padEnd(24)} ` +
      `${String(m.matchNumber).padEnd(4)} ` +
      `${String(m.round).padEnd(6)} ` +
      `${m.status.padEnd(12)} ` +
      `${p1.padEnd(24)} ` +
      `${p2.padEnd(24)} ` +
      `${winner}`
    );
  }

  console.log('─'.repeat(100));
  console.log(`Total: ${snapshot.docs.length} matches\n`);
}

async function listReadyMatches(tournamentId: string) {
  const q = query(
    collection(db, `tournaments/${tournamentId}/matches`),
    where('status', 'in', ['scheduled', 'ready']),
    orderBy('round'),
    orderBy('matchNumber')
  );

  const snapshot = await getDocs(q);

  // Filter to only show matches with both participants
  const readyMatches = snapshot.docs.filter(doc => {
    const m = doc.data();
    return m.participant1Id && m.participant2Id;
  });

  console.log('\n🎯 Ready to Play:');
  console.log('─'.repeat(80));

  for (const doc of readyMatches) {
    const m = doc.data();
    console.log(`  Match #${m.matchNumber} (${doc.id})`);
    console.log(`    P1: ${m.participant1Id}`);
    console.log(`    P2: ${m.participant2Id}`);
    console.log(`    Status: ${m.status} | Round: ${m.round}`);
    console.log('');
  }

  console.log(`Total: ${readyMatches.length} ready matches\n`);

  // Quick complete command helper
  if (readyMatches.length > 0) {
    const first = readyMatches[0];
    const m = first.data();
    console.log('Quick complete (copy/paste):');
    console.log(`  npx ts-node scripts/test-match.ts complete ${tournamentId} ${first.id} ${m.participant1Id}`);
    console.log(`  npx ts-node scripts/test-match.ts complete ${tournamentId} ${first.id} ${m.participant2Id}`);
  }
}

// Parse command line args
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
