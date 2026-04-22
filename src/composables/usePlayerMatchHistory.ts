/**
 * usePlayerMatchHistory
 *
 * Loads a global player's match history across all tournaments.
 *
 * Architecture:
 *  - fetchPlayerMatchHistory is a pure async function (testable without Vue mocks).
 *  - usePlayerMatchHistory is the Vue composable wrapper for component consumption.
 *
 * Query strategy:
 *  1. Fetch tournaments, registrations, players, and categories with tournament-scoped reads.
 *  2. Find the player's registrations locally (primary or partner) to avoid collection-group index dependencies.
 *  3. For each relevant category, read category + level /participant, /match, and /match_scores collections.
 *  4. Resolve sparse match_scores docs through bracket participant IDs when participant1Id/participant2Id are missing.
 *  5. Assemble TournamentHistoryEntry[] sorted by tournament startDate descending.
 */

import { ref } from 'vue';
import {
  db,
  collection,
  getDocs,
} from '@/services/firebase';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { convertTimestamps } from '@/utils/firestore';
import type {
  Category,
  CategoryType,
  GameScore,
  MatchHistoryEntry,
  Player,
  Registration,
  Tournament,
  TournamentHistoryEntry,
} from '@/types';

type RegistrationRole = 'primary' | 'partner';

interface RegistrationEntry {
  reg: Registration;
  role: RegistrationRole;
}

interface MatchScopeTarget {
  matchPath: string;
  matchScorePath: string;
  participantPath: string;
}

interface BracketParticipantRecord {
  id?: string | number | null;
  name?: string | null;
}

interface BracketMatchOpponentRecord {
  id?: string | number | null;
  registrationId?: string | null;
  result?: string | null;
}

interface BracketMatchRecord {
  id?: string | number | null;
  opponent1?: BracketMatchOpponentRecord | null;
  opponent2?: BracketMatchOpponentRecord | null;
}

interface MatchScoreRecord {
  id: string;
  participant1Id?: string | null;
  participant2Id?: string | null;
  winnerId?: string | null;
  status?: string | null;
  scores?: GameScore[];
  completedAt?: Date;
}

interface ResolvedHistoryMatch {
  matchId: string;
  participant1Id: string;
  participant2Id: string;
  winnerId: string;
  status: 'completed' | 'walkover';
  scores: GameScore[];
  completedAt?: Date;
}

function toLookupKey(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function buildRegistrationEntries(
  registrations: Registration[],
  globalPlayerId: string
): RegistrationEntry[] {
  const entries: RegistrationEntry[] = [];

  for (const reg of registrations) {
    if (reg.playerId === globalPlayerId) {
      entries.push({ reg, role: 'primary' });
      continue;
    }

    if (reg.partnerPlayerId === globalPlayerId) {
      entries.push({ reg, role: 'partner' });
    }
  }

  return entries;
}

function buildMatchScopeTargets(
  tournamentId: string,
  categoryId: string,
  levelIds: string[]
): MatchScopeTarget[] {
  const categoryBasePath = `tournaments/${tournamentId}/categories/${categoryId}`;
  const targets: MatchScopeTarget[] = [
    {
      matchPath: `${categoryBasePath}/match`,
      matchScorePath: `${categoryBasePath}/match_scores`,
      participantPath: `${categoryBasePath}/participant`,
    },
  ];

  for (const levelId of levelIds) {
    const levelBasePath = `${categoryBasePath}/levels/${levelId}`;
    targets.push({
      matchPath: `${levelBasePath}/match`,
      matchScorePath: `${levelBasePath}/match_scores`,
      participantPath: `${levelBasePath}/participant`,
    });
  }

  return targets;
}

function buildParticipantRegistrationLookup(
  participants: BracketParticipantRecord[]
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const participant of participants) {
    const participantId = toLookupKey(participant.id);
    const registrationId =
      typeof participant.name === 'string' && participant.name.length > 0
        ? participant.name
        : null;

    if (!participantId || !registrationId) {
      continue;
    }

    lookup.set(participantId, registrationId);
  }

  return lookup;
}

function resolveOpponentRegistrationId(
  opponent: BracketMatchOpponentRecord | null | undefined,
  participantLookup: Map<string, string>
): string | undefined {
  if (!opponent) {
    return undefined;
  }

  if (
    typeof opponent.registrationId === 'string' &&
    opponent.registrationId.length > 0
  ) {
    return opponent.registrationId;
  }

  const participantId = toLookupKey(opponent.id);
  return participantId ? participantLookup.get(participantId) : undefined;
}

function resolveWinnerRegistrationId(
  bracketMatch: BracketMatchRecord | undefined,
  participant1Id: string | undefined,
  participant2Id: string | undefined
): string | undefined {
  if (bracketMatch?.opponent1?.result === 'win') {
    return participant1Id;
  }

  if (bracketMatch?.opponent2?.result === 'win') {
    return participant2Id;
  }

  return undefined;
}

function normalizeCompletedAt(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return undefined;
}

function resolveHistoryMatch(
  score: MatchScoreRecord,
  bracketMatch: BracketMatchRecord | undefined,
  participantLookup: Map<string, string>
): ResolvedHistoryMatch | null {
  if (score.status !== 'completed' && score.status !== 'walkover') {
    return null;
  }

  const participant1Id =
    score.participant1Id ??
    resolveOpponentRegistrationId(bracketMatch?.opponent1, participantLookup);
  const participant2Id =
    score.participant2Id ??
    resolveOpponentRegistrationId(bracketMatch?.opponent2, participantLookup);
  const winnerId =
    score.winnerId ??
    resolveWinnerRegistrationId(bracketMatch, participant1Id ?? undefined, participant2Id ?? undefined);

  if (!participant1Id || !participant2Id || !winnerId) {
    return null;
  }

  return {
    matchId: score.id,
    participant1Id,
    participant2Id,
    winnerId,
    status: score.status,
    scores: Array.isArray(score.scores) ? score.scores : [],
    completedAt: normalizeCompletedAt(score.completedAt),
  };
}

function resolveOpponentName(
  opponentRegistration: Registration | undefined,
  playerMap: Map<string, Player>
): string {
  if (!opponentRegistration) {
    return 'Unknown';
  }

  if (
    opponentRegistration.participantType === 'team' &&
    opponentRegistration.teamName
  ) {
    return opponentRegistration.teamName;
  }

  if (opponentRegistration.playerId) {
    const player = playerMap.get(opponentRegistration.playerId);
    if (player) {
      return `${player.firstName} ${player.lastName}`;
    }
  }

  return 'Unknown';
}

function resolvePartnerName(
  registration: Registration,
  role: RegistrationRole,
  playerMap: Map<string, Player>
): string | undefined {
  if (registration.participantType !== 'team') {
    return undefined;
  }

  const partnerPlayerId =
    role === 'primary' ? registration.partnerPlayerId : registration.playerId;
  if (!partnerPlayerId) {
    return undefined;
  }

  const partner = playerMap.get(partnerPlayerId);
  return partner ? `${partner.firstName} ${partner.lastName}` : undefined;
}

async function fetchResolvedMatchesForCategory(
  tournamentId: string,
  categoryId: string
): Promise<ResolvedHistoryMatch[]> {
  const levelsSnap = await getDocs(
    collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`)
  );
  const targets = buildMatchScopeTargets(
    tournamentId,
    categoryId,
    levelsSnap.docs.map((docSnap) => docSnap.id)
  );

  const resolvedMatches: ResolvedHistoryMatch[] = [];
  const seenMatchKeys = new Set<string>();

  await Promise.all(
    targets.map(async (target) => {
      const [matchScoresSnap, matchesSnap, participantsSnap] = await Promise.all([
        getDocs(collection(db, target.matchScorePath)),
        getDocs(collection(db, target.matchPath)),
        getDocs(collection(db, target.participantPath)),
      ]);

      const participantLookup = buildParticipantRegistrationLookup(
        participantsSnap.docs.map((docSnap) => docSnap.data() as BracketParticipantRecord)
      );
      const bracketMatchesById = new Map<string, BracketMatchRecord>(
        matchesSnap.docs.map((docSnap) => {
          const match = docSnap.data() as BracketMatchRecord;
          return [toLookupKey(match.id) ?? docSnap.id, match] as const;
        })
      );

      for (const docSnap of matchScoresSnap.docs) {
        const score = convertTimestamps({
          id: docSnap.id,
          ...docSnap.data(),
        }) as MatchScoreRecord;
        const resolved = resolveHistoryMatch(
          score,
          bracketMatchesById.get(docSnap.id),
          participantLookup
        );

        if (!resolved) {
          continue;
        }

        const dedupeKey = `${target.matchScorePath}/${resolved.matchId}`;
        if (seenMatchKeys.has(dedupeKey)) {
          continue;
        }

        seenMatchKeys.add(dedupeKey);
        resolvedMatches.push(resolved);
      }
    })
  );

  resolvedMatches.sort((a, b) => {
    const aTime = a.completedAt?.getTime() ?? 0;
    const bTime = b.completedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return resolvedMatches;
}

// ---------------------------------------------------------------------------
// Pure async function — the testable core
// ---------------------------------------------------------------------------

export async function fetchPlayerMatchHistory(
  globalPlayerId: string
): Promise<TournamentHistoryEntry[]> {
  const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
  const entries: TournamentHistoryEntry[] = [];

  await Promise.all(
    tournamentsSnap.docs.map(async (tournamentDoc) => {
      const tournament = convertTimestamps({
        id: tournamentDoc.id,
        ...tournamentDoc.data(),
      }) as Tournament;
      const tournamentId = tournamentDoc.id;

      const [playersSnap, registrationsSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, `tournaments/${tournamentId}/players`)),
        getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
        getDocs(collection(db, `tournaments/${tournamentId}/categories`)),
      ]);

      const registrations = registrationsSnap.docs.map((docSnap) =>
        convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Registration
      );
      const registrationEntries = buildRegistrationEntries(
        registrations,
        globalPlayerId
      );

      if (registrationEntries.length === 0) {
        return;
      }

      const playerMap = new Map<string, Player>(
        playersSnap.docs.map((docSnap) => [
          docSnap.id,
          convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Player,
        ])
      );
      const registrationMap = new Map<string, Registration>(
        registrations.map((registration) => [registration.id, registration])
      );
      const categoryMap = new Map<string, Category>(
        categoriesSnap.docs.map((docSnap) => [
          docSnap.id,
          convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Category,
        ])
      );

      const categoryMatchCache = new Map<string, Promise<ResolvedHistoryMatch[]>>();

      for (const { reg, role } of registrationEntries) {
        if (!categoryMatchCache.has(reg.categoryId)) {
          categoryMatchCache.set(
            reg.categoryId,
            fetchResolvedMatchesForCategory(tournamentId, reg.categoryId)
          );
        }

        const category = categoryMap.get(reg.categoryId);
        const resolvedMatches = await categoryMatchCache.get(reg.categoryId)!;

        const matches: MatchHistoryEntry[] = resolvedMatches
          .filter(
            (match) =>
              match.participant1Id === reg.id || match.participant2Id === reg.id
          )
          .map((match) => {
            const opponentRegistrationId =
              match.participant1Id === reg.id
                ? match.participant2Id
                : match.participant1Id;

            return {
              matchId: match.matchId,
              opponentName: resolveOpponentName(
                registrationMap.get(opponentRegistrationId),
                playerMap
              ),
              partnerName: resolvePartnerName(reg, role, playerMap),
              scores: match.scores,
              result:
                match.status === 'walkover'
                  ? 'walkover'
                  : match.winnerId === reg.id
                    ? 'win'
                    : 'loss',
              completedAt: match.completedAt,
              categoryType: (category?.type ?? 'singles') as CategoryType,
            };
          });

        entries.push({
          tournamentId,
          tournamentName: tournament.name,
          startDate: tournament.startDate,
          sport: tournament.sport,
          categoryId: reg.categoryId,
          categoryName: category?.name ?? reg.categoryId,
          categoryType: (category?.type ?? 'singles') as CategoryType,
          registrationId: reg.id,
          matches,
        });
      }
    })
  );

  entries.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  return entries;
}

// ---------------------------------------------------------------------------
// Vue composable wrapper
// ---------------------------------------------------------------------------

export function usePlayerMatchHistory() {
  const history = ref<TournamentHistoryEntry[]>([]);
  const { execute, loading, error } = useAsyncOperation<TournamentHistoryEntry[]>();

  async function loadHistory(globalPlayerId: string): Promise<void> {
    await execute(async () => {
      const result = await fetchPlayerMatchHistory(globalPlayerId);
      history.value = result;
      return result;
    });
  }

  return { history, loading, error, loadHistory };
}
