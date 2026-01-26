// Bracket Generation Logic
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Match, TournamentFormat, Registration } from './types';

// Get db lazily to avoid initialization order issues
function getDb() {
  return admin.firestore();
}

/**
 * Generate bracket for a category
 */
export async function generateBracket(
  tournamentId: string,
  categoryId: string
): Promise<void> {
  const db = getDb();

  // Get category details
  const categoryDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .get();

  if (!categoryDoc.exists) {
    throw new Error('Category not found');
  }

  const category = categoryDoc.data();
  const format = category?.format as TournamentFormat;

  // Get approved/checked-in registrations
  const registrationsSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('registrations')
    .where('categoryId', '==', categoryId)
    .where('status', 'in', ['approved', 'checked_in'])
    .get();

  const registrations: Registration[] = registrationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Registration[];

  if (registrations.length < 2) {
    throw new Error('Need at least 2 participants to generate bracket');
  }

  // Sort by seed (seeded players first, then random)
  const seededRegistrations = registrations
    .filter((r) => r.seed !== undefined)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));

  const unseededRegistrations = registrations
    .filter((r) => r.seed === undefined)
    .sort(() => Math.random() - 0.5);

  const sortedRegistrations = [...seededRegistrations, ...unseededRegistrations];

  // Delete existing matches for this category
  const existingMatches = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .where('categoryId', '==', categoryId)
    .get();

  const batch = db.batch();
  existingMatches.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Generate bracket based on format
  let matches: Omit<Match, 'id'>[];

  switch (format) {
    case 'single_elimination':
      matches = generateSingleEliminationBracket(
        tournamentId,
        categoryId,
        sortedRegistrations
      );
      break;
    case 'double_elimination':
      matches = generateDoubleEliminationBracket(
        tournamentId,
        categoryId,
        sortedRegistrations
      );
      break;
    case 'round_robin':
      matches = generateRoundRobinMatches(
        tournamentId,
        categoryId,
        sortedRegistrations
      );
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Process bye matches - advance winners to their next matches
  processAdvanceByeWinners(matches);

  // Save matches to Firestore
  const matchBatch = db.batch();
  const matchRefs: admin.firestore.DocumentReference[] = [];

  for (const match of matches) {
    const ref = db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc();
    matchRefs.push(ref);

    // Remove undefined values (Firestore doesn't accept them)
    const cleanMatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(match)) {
      if (value !== undefined) {
        cleanMatch[key] = value;
      }
    }

    matchBatch.set(ref, {
      ...cleanMatch,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await matchBatch.commit();

  // Update next match references
  await updateNextMatchReferences(tournamentId, categoryId, matches, matchRefs);

  // Update category status
  await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .update({
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Generate single elimination bracket
 */
function generateSingleEliminationBracket(
  tournamentId: string,
  categoryId: string,
  registrations: Registration[]
): Omit<Match, 'id'>[] {
  const matches: Omit<Match, 'id'>[] = [];
  const numParticipants = registrations.length;

  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
  const numByes = bracketSize - numParticipants;
  const numRounds = Math.log2(bracketSize);

  // Position participants with byes spread evenly
  const positions: (Registration | null)[] = new Array(bracketSize).fill(null);
  const byePositions = calculateByePositions(bracketSize, numByes);

  let regIndex = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!byePositions.includes(i)) {
      positions[i] = registrations[regIndex++];
    }
  }

  // Generate first round matches
  let matchNumber = 1;
  const firstRoundMatches: number[] = [];

  for (let i = 0; i < bracketSize / 2; i++) {
    const p1 = positions[i * 2];
    const p2 = positions[i * 2 + 1];

    // Skip if both are byes
    if (!p1 && !p2) continue;

    const match: Omit<Match, 'id'> = {
      tournamentId,
      categoryId,
      round: 1,
      matchNumber: matchNumber++,
      bracketPosition: {
        bracket: 'winners',
        round: 1,
        position: i + 1,
      },
      participant1Id: p1?.id,
      participant2Id: p2?.id,
      status: 'scheduled',
      scores: [],
    };

    // If one participant has a bye, auto-advance
    if (p1 && !p2) {
      match.status = 'completed';
      match.winnerId = p1.id;
    } else if (!p1 && p2) {
      match.status = 'completed';
      match.winnerId = p2.id;
    }

    matches.push(match);
    firstRoundMatches.push(matches.length - 1);
  }

  // Generate subsequent rounds
  let previousRoundMatches = firstRoundMatches;

  for (let round = 2; round <= numRounds; round++) {
    const roundMatches: number[] = [];
    const matchesInRound = Math.pow(2, numRounds - round);

    for (let i = 0; i < matchesInRound; i++) {
      const match: Omit<Match, 'id'> = {
        tournamentId,
        categoryId,
        round,
        matchNumber: matchNumber++,
        bracketPosition: {
          bracket: 'winners',
          round,
          position: i + 1,
        },
        status: 'scheduled',
        scores: [],
      };

      matches.push(match);
      roundMatches.push(matches.length - 1);
    }

    // Link previous round to this round
    for (let i = 0; i < previousRoundMatches.length; i += 2) {
      const nextMatchIndex = roundMatches[Math.floor(i / 2)];

      if (previousRoundMatches[i] !== undefined) {
        matches[previousRoundMatches[i]].nextMatchId = `MATCH_${nextMatchIndex}`;
        matches[previousRoundMatches[i]].nextMatchSlot = 'participant1';
      }

      if (previousRoundMatches[i + 1] !== undefined) {
        matches[previousRoundMatches[i + 1]].nextMatchId = `MATCH_${nextMatchIndex}`;
        matches[previousRoundMatches[i + 1]].nextMatchSlot = 'participant2';
      }
    }

    previousRoundMatches = roundMatches;
  }

  return matches;
}

/**
 * Generate double elimination bracket
 */
function generateDoubleEliminationBracket(
  tournamentId: string,
  categoryId: string,
  registrations: Registration[]
): Omit<Match, 'id'>[] {
  const numParticipants = registrations.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
  const winnersRounds = Math.log2(bracketSize);
  const numByes = bracketSize - numParticipants;

  const allMatches: Omit<Match, 'id'>[] = [];
  let matchNumber = 1;

  // Track match indices for linking
  const winnersMatchesByRound: number[][] = [];
  const losersMatchesByRound: number[][] = [];

  // Position participants with byes spread evenly
  const positions: (Registration | null)[] = new Array(bracketSize).fill(null);
  const byePositions = calculateByePositions(bracketSize, numByes);

  let regIndex = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!byePositions.includes(i)) {
      positions[i] = registrations[regIndex++];
    }
  }

  // ========== WINNERS BRACKET ==========
  for (let round = 1; round <= winnersRounds; round++) {
    const matchesInRound = Math.pow(2, winnersRounds - round);
    const roundMatches: number[] = [];

    for (let i = 0; i < matchesInRound; i++) {
      const match: Omit<Match, 'id'> = {
        tournamentId,
        categoryId,
        round,
        matchNumber: matchNumber++,
        bracketPosition: {
          bracket: 'winners',
          round,
          position: i + 1,
        },
        status: 'scheduled',
        scores: [],
      };

      // First round: assign participants
      if (round === 1) {
        const p1 = positions[i * 2];
        const p2 = positions[i * 2 + 1];
        match.participant1Id = p1?.id;
        match.participant2Id = p2?.id;

        // Handle byes
        if (p1 && !p2) {
          match.status = 'completed';
          match.winnerId = p1.id;
        } else if (!p1 && p2) {
          match.status = 'completed';
          match.winnerId = p2.id;
        }
      }

      allMatches.push(match);
      roundMatches.push(allMatches.length - 1);
    }

    winnersMatchesByRound.push(roundMatches);
  }

  // ========== LOSERS BRACKET ==========
  // Losers bracket has (2 * winnersRounds - 2) rounds
  // Odd rounds: losers from winners drop down
  // Even rounds: losers bracket internal matches
  const losersRounds = Math.max(0, 2 * winnersRounds - 2);

  for (let lRound = 1; lRound <= losersRounds; lRound++) {
    // In losers bracket:
    // - Round 1 has bracketSize/4 matches (losers from WR1)
    // - Subsequent rounds alternate between receiving dropdowns and internal matches
    let matchesInRound: number;

    if (lRound === 1) {
      matchesInRound = Math.max(1, bracketSize / 4);
    } else {
      // After round 1, matches halve every 2 rounds
      matchesInRound = Math.max(1, Math.pow(2, Math.floor((losersRounds - lRound) / 2)));
    }

    const roundMatches: number[] = [];

    for (let i = 0; i < matchesInRound; i++) {
      const match: Omit<Match, 'id'> = {
        tournamentId,
        categoryId,
        round: winnersRounds + lRound,
        matchNumber: matchNumber++,
        bracketPosition: {
          bracket: 'losers',
          round: lRound,
          position: i + 1,
        },
        isLosersBracket: true,
        status: 'scheduled',
        scores: [],
      };

      allMatches.push(match);
      roundMatches.push(allMatches.length - 1);
    }

    losersMatchesByRound.push(roundMatches);
  }

  // ========== GRAND FINALS ==========
  const grandFinalsIndex = allMatches.length;
  const grandFinals: Omit<Match, 'id'> = {
    tournamentId,
    categoryId,
    round: winnersRounds + losersRounds + 1,
    matchNumber: matchNumber++,
    bracketPosition: {
      bracket: 'finals',
      round: 1,
      position: 1,
    },
    status: 'scheduled',
    scores: [],
  };
  allMatches.push(grandFinals);

  // Grand finals reset (if losers bracket winner wins first grand final)
  const grandFinalsResetIndex = allMatches.length;
  const grandFinalsReset: Omit<Match, 'id'> = {
    tournamentId,
    categoryId,
    round: winnersRounds + losersRounds + 2,
    matchNumber: matchNumber++,
    bracketPosition: {
      bracket: 'finals',
      round: 2,
      position: 1,
    },
    status: 'scheduled',
    scores: [],
  };
  allMatches.push(grandFinalsReset);

  // ========== LINK WINNERS BRACKET ==========
  for (let round = 0; round < winnersMatchesByRound.length; round++) {
    const currentRoundMatches = winnersMatchesByRound[round];

    for (let i = 0; i < currentRoundMatches.length; i++) {
      const matchIdx = currentRoundMatches[i];

      // Winner advances to next winners round
      if (round < winnersMatchesByRound.length - 1) {
        const nextRoundMatches = winnersMatchesByRound[round + 1];
        const nextMatchIdx = nextRoundMatches[Math.floor(i / 2)];
        allMatches[matchIdx].nextMatchId = `MATCH_${nextMatchIdx}`;
        allMatches[matchIdx].nextMatchSlot = i % 2 === 0 ? 'participant1' : 'participant2';
      } else {
        // Winners final winner goes to grand finals
        allMatches[matchIdx].nextMatchId = `MATCH_${grandFinalsIndex}`;
        allMatches[matchIdx].nextMatchSlot = 'participant1';
      }

      // Loser drops to losers bracket
      if (losersMatchesByRound.length > 0) {
        // Map winners round losers to appropriate losers round
        // WR1 losers -> LR1 (index 0), WR2 losers -> LR2 (index 1), etc.
        // Note: round is 1-based, losersMatchesByRound is 0-indexed
        const losersRoundIndex = round - 1; // Convert to 0-based
        const losersRoundForDropdown = losersRoundIndex < losersMatchesByRound.length ? losersRoundIndex : losersMatchesByRound.length - 1;
        const losersRoundMatches = losersMatchesByRound[losersRoundForDropdown];

        if (losersRoundMatches && losersRoundMatches.length > 0) {
          const loserMatchIdx = losersRoundMatches[i % losersRoundMatches.length];
          allMatches[matchIdx].loserNextMatchId = `MATCH_${loserMatchIdx}`;
          // Alternate slot assignment for dropped losers
          allMatches[matchIdx].loserNextMatchSlot = i % 2 === 0 ? 'participant1' : 'participant2';
        }
      }
    }
  }

  // ========== LINK LOSERS BRACKET ==========
  for (let lRound = 0; lRound < losersMatchesByRound.length; lRound++) {
    const currentRoundMatches = losersMatchesByRound[lRound];

    for (let i = 0; i < currentRoundMatches.length; i++) {
      const matchIdx = currentRoundMatches[i];

      if (lRound < losersMatchesByRound.length - 1) {
        // Winner advances in losers bracket
        const nextRoundMatches = losersMatchesByRound[lRound + 1];
        const nextMatchIdx = nextRoundMatches[Math.floor(i / 2) % nextRoundMatches.length];
        allMatches[matchIdx].nextMatchId = `MATCH_${nextMatchIdx}`;
        allMatches[matchIdx].nextMatchSlot = i % 2 === 0 ? 'participant1' : 'participant2';
      } else {
        // Losers final winner goes to grand finals
        allMatches[matchIdx].nextMatchId = `MATCH_${grandFinalsIndex}`;
        allMatches[matchIdx].nextMatchSlot = 'participant2';
      }
    }
  }

  // ========== LINK GRAND FINALS ==========
  // Grand finals winner goes to reset (if needed)
  allMatches[grandFinalsIndex].nextMatchId = `MATCH_${grandFinalsResetIndex}`;
  allMatches[grandFinalsIndex].nextMatchSlot = 'participant1';
  // Loser from grand finals also goes to reset as participant2
  allMatches[grandFinalsIndex].loserNextMatchId = `MATCH_${grandFinalsResetIndex}`;
  allMatches[grandFinalsIndex].loserNextMatchSlot = 'participant2';

  return allMatches;
}

/**
 * Generate round robin matches - everyone plays everyone
 */
function generateRoundRobinMatches(
  tournamentId: string,
  categoryId: string,
  registrations: Registration[]
): Omit<Match, 'id'>[] {
  const matches: Omit<Match, 'id'>[] = [];
  const n = registrations.length;

  if (n < 2) {
    throw new Error('Need at least 2 participants for round robin');
  }

  let matchNumber = 1;

  // Use circle method for round robin scheduling
  // If odd number of participants, add a "bye" slot
  const participants = [...registrations];
  const hasBye = n % 2 === 1;
  if (hasBye) {
    participants.push({ id: 'BYE' } as Registration);
  }

  const numParticipants = participants.length;
  const numRounds = numParticipants - 1;
  const matchesPerRound = numParticipants / 2;

  // Circle method: fix one participant, rotate others
  for (let round = 0; round < numRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = match === 0 ? 0 : (round + match) % (numParticipants - 1) + 1;
      const away = (round + numParticipants - 1 - match) % (numParticipants - 1) + 1;

      const homeParticipant = participants[home === 0 ? 0 : home];
      const awayParticipant = participants[away === 0 ? 0 : away];

      // Skip bye matches
      if (homeParticipant.id === 'BYE' || awayParticipant.id === 'BYE') {
        continue;
      }

      const matchData: Omit<Match, 'id'> = {
        tournamentId,
        categoryId,
        round: round + 1,
        matchNumber: matchNumber++,
        bracketPosition: {
          bracket: 'winners', // Using 'winners' for round robin
          round: round + 1,
          position: match + 1,
        },
        participant1Id: homeParticipant.id,
        participant2Id: awayParticipant.id,
        status: 'ready', // All round robin matches can be played immediately
        scores: [],
      };

      matches.push(matchData);
    }
  }

  return matches;
}

/**
 * Process bye matches and advance winners to their next matches
 * This ensures that bye winners are placed directly into subsequent rounds
 */
function processAdvanceByeWinners(matches: Omit<Match, 'id'>[]): void {
  // Keep processing until no more advancements are made
  let advancementMade = true;

  while (advancementMade) {
    advancementMade = false;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];

      // Skip if not completed (bye matches are marked completed)
      if (match.status !== 'completed' || !match.winnerId) continue;

      // Check if winner needs to advance
      if (match.nextMatchId?.startsWith('MATCH_')) {
        const nextMatchIndex = parseInt(match.nextMatchId.replace('MATCH_', ''));
        const nextMatch = matches[nextMatchIndex];

        if (nextMatch) {
          const slot = match.nextMatchSlot;
          const slotKey = `${slot}Id` as 'participant1Id' | 'participant2Id';

          // Only advance if the slot is empty
          if (!nextMatch[slotKey]) {
            nextMatch[slotKey] = match.winnerId;
            advancementMade = true;

            // If both participants are now set, the match is ready to play
            if (nextMatch.participant1Id && nextMatch.participant2Id) {
              nextMatch.status = 'scheduled';
            }
            // If only one participant is set, it will be handled in subsequent iterations
            // when the other bye match advances its winner
          }
        }
      }
    }
  }
}

/**
 * Calculate bye positions for even distribution
 */
function calculateByePositions(bracketSize: number, numByes: number): number[] {
  const positions: number[] = [];

  if (numByes === 0) return positions;

  // Distribute byes evenly from the bottom seeds
  const step = bracketSize / numByes;
  for (let i = 0; i < numByes; i++) {
    positions.push(Math.floor(i * step) + 1);
  }

  return positions;
}

/**
 * Update next match references with actual document IDs
 */
async function updateNextMatchReferences(
  tournamentId: string,
  categoryId: string,
  matches: Omit<Match, 'id'>[],
  matchRefs: admin.firestore.DocumentReference[]
): Promise<void> {
  const db = getDb();
  const batch = db.batch();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const updates: Record<string, string> = {};

    if (match.nextMatchId?.startsWith('MATCH_')) {
      const nextIndex = parseInt(match.nextMatchId.replace('MATCH_', ''));
      if (matchRefs[nextIndex]) {
        updates.nextMatchId = matchRefs[nextIndex].id;
      }
    }

    if (match.loserNextMatchId?.startsWith('MATCH_')) {
      const nextIndex = parseInt(match.loserNextMatchId.replace('MATCH_', ''));
      if (matchRefs[nextIndex]) {
        updates.loserNextMatchId = matchRefs[nextIndex].id;
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.update(matchRefs[i], updates);
    }
  }

  await batch.commit();
}
