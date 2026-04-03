import type { GlobalPlayer } from '@/types';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase';

// ============================================
// Pure ranking logic (unit-testable, no Firestore)
// ============================================

export type CandidateSignal = 'userId' | 'name+phone' | 'name+email' | 'email' | 'name';

const SIGNAL_SCORE: Record<CandidateSignal, number> = {
  userId: 100,
  'name+phone': 50,
  'name+email': 40,
  email: 8,
  name: 5,
};

export interface CandidateMatch {
  player: GlobalPlayer;
  matchScore: number;
  matchedSignals: CandidateSignal[];
}

export interface PlayerInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function namesMatch(player: GlobalPlayer, input: PlayerInput): boolean {
  return (
    player.firstName.toLowerCase() === input.firstName.toLowerCase() &&
    player.lastName.toLowerCase() === input.lastName.toLowerCase()
  );
}

function emailsMatch(player: GlobalPlayer, input: PlayerInput): boolean {
  if (!input.email || !player.emailNormalized) return false;
  return player.emailNormalized.toLowerCase() === input.email.toLowerCase();
}

function phonesMatch(player: GlobalPlayer, input: PlayerInput): boolean {
  if (!input.phone || !player.phone) return false;
  return stripNonDigits(player.phone) === stripNonDigits(input.phone);
}

export function rankCandidates(
  players: GlobalPlayer[],
  input: PlayerInput,
  maxResults = 5,
): CandidateMatch[] {
  const results: CandidateMatch[] = [];

  for (const player of players) {
    // Skip merged/inactive players
    if (player.identityStatus === 'merged' || !player.isActive) {
      continue;
    }

    const signals: CandidateSignal[] = [];

    // userId signal (highest priority)
    if (input.userId && player.userId && player.userId === input.userId) {
      signals.push('userId');
    }

    const nameMatch = namesMatch(player, input);
    const emailMatch = emailsMatch(player, input);
    const phoneMatch = phonesMatch(player, input);

    // name+phone: names match AND phone digits match
    if (nameMatch && phoneMatch) {
      signals.push('name+phone');
    }

    // name+email: names match AND emailNormalized match
    if (nameMatch && emailMatch) {
      signals.push('name+email');
    }

    // email: emailNormalized match but names do NOT match (email-only case)
    if (emailMatch && !nameMatch) {
      signals.push('email');
    }

    // name: names match but no other signal matched
    if (nameMatch && signals.length === 0) {
      signals.push('name');
    }

    // Only include players with at least one signal
    if (signals.length === 0) {
      continue;
    }

    const matchScore = signals.reduce((sum, signal) => sum + SIGNAL_SCORE[signal], 0);

    results.push({ player, matchScore, matchedSignals: signals });
  }

  // Sort descending by score
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results.slice(0, maxResults);
}

// ============================================
// Firestore operations
// ============================================

export async function findPlayerCandidates(input: PlayerInput): Promise<CandidateMatch[]> {
  const playersRef = collection(db, 'players');
  const playerMap = new Map<string, GlobalPlayer>();

  // Query by emailNormalized if provided
  if (input.email) {
    const emailQuery = query(
      playersRef,
      where('emailNormalized', '==', input.email.toLowerCase()),
    );
    const emailSnap = await getDocs(emailQuery);
    for (const docSnap of emailSnap.docs) {
      const data = docSnap.data();
      playerMap.set(docSnap.id, { id: docSnap.id, ...data } as GlobalPlayer);
    }
  }

  // Query by lastName to find name candidates
  const nameQuery = query(playersRef, where('lastName', '==', input.lastName));
  const nameSnap = await getDocs(nameQuery);
  for (const docSnap of nameSnap.docs) {
    if (!playerMap.has(docSnap.id)) {
      const data = docSnap.data();
      playerMap.set(docSnap.id, { id: docSnap.id, ...data } as GlobalPlayer);
    }
  }

  const candidates = Array.from(playerMap.values());
  return rankCandidates(candidates, input);
}

export async function linkOrCreatePlayer(
  input: PlayerInput,
  chosenPlayerId: string | null,
): Promise<string> {
  if (chosenPlayerId !== null) {
    // Verify the player exists, is active, and not merged
    const playerRef = doc(db, 'players', chosenPlayerId);
    const playerSnap = await getDoc(playerRef);

    if (!playerSnap.exists()) {
      throw new Error(`Player ${chosenPlayerId} does not exist`);
    }

    const playerData = playerSnap.data() as GlobalPlayer;

    if (!playerData.isActive) {
      throw new Error(`Player ${chosenPlayerId} is not active`);
    }

    if (playerData.identityStatus === 'merged') {
      throw new Error(`Player ${chosenPlayerId} has been merged into another player`);
    }

    return chosenPlayerId;
  }

  // Create a new player doc
  const playersRef = collection(db, 'players');
  const newPlayerData = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    emailNormalized: input.email ? input.email.toLowerCase() : null,
    phone: input.phone ?? null,
    userId: input.userId ?? null,
    isActive: true,
    isVerified: false,
    identityStatus: 'active' as const,
    mergedIntoPlayerId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    stats: {
      overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
    },
  };

  const newDocRef = await addDoc(playersRef, newPlayerData);
  return newDocRef.id;
}
