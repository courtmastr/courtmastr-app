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
 *  1. Two collectionGroup queries on 'registrations' (playerId and partnerPlayerId).
 *  2. Group registrations by tournamentId.
 *  3. Per tournament: batch-fetch players, registrations, categories.
 *  4. Per registration: two match_scores queries (participant1Id/participant2Id).
 *  5. Resolve opponent names and partner names; assemble TournamentHistoryEntry[].
 *  6. Sort by tournament startDate descending.
 */

import { ref } from 'vue';
import {
  db,
  collection,
  collectionGroup,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from '@/services/firebase';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { convertTimestamps } from '@/utils/firestore';
import type {
  Registration,
  Tournament,
  Category,
  Match,
  MatchHistoryEntry,
  TournamentHistoryEntry,
} from '@/types';

// ---------------------------------------------------------------------------
// Pure async function — the testable core
// ---------------------------------------------------------------------------

export async function fetchPlayerMatchHistory(
  globalPlayerId: string
): Promise<TournamentHistoryEntry[]> {
  // Step 1: Find all registrations for this player (as primary or as partner)
  const [primarySnap, partnerSnap] = await Promise.all([
    getDocs(query(collectionGroup(db, 'registrations'), where('playerId', '==', globalPlayerId))),
    getDocs(
      query(collectionGroup(db, 'registrations'), where('partnerPlayerId', '==', globalPlayerId))
    ),
  ]);

  type RegEntry = { reg: Registration; role: 'primary' | 'partner' };
  const regMap = new Map<string, RegEntry>();

  primarySnap.docs.forEach((d) => {
    const reg = convertTimestamps({ id: d.id, ...d.data() }) as Registration;
    regMap.set(d.id, { reg, role: 'primary' });
  });
  partnerSnap.docs.forEach((d) => {
    if (!regMap.has(d.id)) {
      const reg = convertTimestamps({ id: d.id, ...d.data() }) as Registration;
      regMap.set(d.id, { reg, role: 'partner' });
    }
  });

  if (regMap.size === 0) return [];

  // Step 2: Group by tournamentId
  const byTournament = new Map<string, RegEntry[]>();
  regMap.forEach((entry) => {
    const tId = entry.reg.tournamentId;
    if (!byTournament.has(tId)) byTournament.set(tId, []);
    byTournament.get(tId)!.push(entry);
  });

  // Step 3: Per tournament — fetch tournament doc, players, registrations, categories
  const entries: TournamentHistoryEntry[] = [];

  await Promise.all(
    Array.from(byTournament.entries()).map(async ([tId, regEntries]) => {
      const [tournamentSnap, allPlayersSnap, allRegsSnap, allCatsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tId)),
        getDocs(collection(db, `tournaments/${tId}/players`)),
        getDocs(collection(db, `tournaments/${tId}/registrations`)),
        getDocs(collection(db, `tournaments/${tId}/categories`)),
      ]);

      if (!tournamentSnap.exists()) return;

      const tournament = convertTimestamps({
        id: tournamentSnap.id,
        ...tournamentSnap.data(),
      }) as Tournament;

      const playerMap = new Map<string, { firstName: string; lastName: string }>();
      allPlayersSnap.docs.forEach((d) => {
        playerMap.set(d.id, d.data() as { firstName: string; lastName: string });
      });

      const allRegsMap = new Map<string, Registration>();
      allRegsSnap.docs.forEach((d) => {
        allRegsMap.set(d.id, convertTimestamps({ id: d.id, ...d.data() }) as Registration);
      });

      const categoryMap = new Map<string, Category>();
      allCatsSnap.docs.forEach((d) => {
        categoryMap.set(d.id, convertTimestamps({ id: d.id, ...d.data() }) as Category);
      });

      // Step 4: Per registration — fetch completed match_scores
      for (const { reg, role } of regEntries) {
        const matchScorePath = `tournaments/${tId}/categories/${reg.categoryId}/match_scores`;
        const category = categoryMap.get(reg.categoryId);

        const [snap1, snap2] = await Promise.all([
          getDocs(
            query(
              collection(db, matchScorePath),
              where('participant1Id', '==', reg.id),
              where('status', 'in', ['completed', 'walkover'])
            )
          ),
          getDocs(
            query(
              collection(db, matchScorePath),
              where('participant2Id', '==', reg.id),
              where('status', 'in', ['completed', 'walkover'])
            )
          ),
        ]);

        // Deduplicate by match ID
        const matchMap = new Map<string, Match>();
        [...snap1.docs, ...snap2.docs].forEach((d) => {
          if (!matchMap.has(d.id)) {
            matchMap.set(d.id, convertTimestamps({ id: d.id, ...d.data() }) as Match);
          }
        });

        const matches: MatchHistoryEntry[] = [];

        for (const match of matchMap.values()) {
          // Determine opponent registration
          const opponentRegId =
            match.participant1Id === reg.id ? match.participant2Id! : match.participant1Id!;
          const opponentReg = allRegsMap.get(opponentRegId);

          let opponentName = 'Unknown';
          if (opponentReg) {
            if (opponentReg.participantType === 'team' && opponentReg.teamName) {
              opponentName = opponentReg.teamName;
            } else if (opponentReg.playerId) {
              const p = playerMap.get(opponentReg.playerId);
              opponentName = p ? `${p.firstName} ${p.lastName}` : 'Unknown';
            }
          }

          // Determine partner name for doubles
          let partnerName: string | undefined;
          if (reg.participantType === 'team') {
            // role='primary': partner is partnerPlayerId
            // role='partner': partner is playerId (the primary player from this player's view)
            const partnerPlayerId =
              role === 'primary' ? reg.partnerPlayerId : reg.playerId;
            if (partnerPlayerId) {
              const p = playerMap.get(partnerPlayerId);
              partnerName = p ? `${p.firstName} ${p.lastName}` : undefined;
            }
          }

          const result: 'win' | 'loss' | 'walkover' =
            match.status === 'walkover'
              ? 'walkover'
              : match.winnerId === reg.id
                ? 'win'
                : 'loss';

          matches.push({
            matchId: match.id,
            opponentName,
            partnerName,
            scores: match.scores ?? [],
            result,
            completedAt: match.completedAt,
            categoryType: category?.type ?? 'singles',
          });
        }

        entries.push({
          tournamentId: tId,
          tournamentName: tournament.name,
          startDate: tournament.startDate,
          sport: tournament.sport,
          categoryId: reg.categoryId,
          categoryName: category?.name ?? reg.categoryId,
          categoryType: category?.type ?? 'singles',
          registrationId: reg.id,
          matches,
        });
      }
    })
  );

  // Sort by tournament startDate descending (newest first)
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
