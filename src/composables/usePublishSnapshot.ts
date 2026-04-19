/**
 * usePublishSnapshot
 *
 * Collects current tournament state from Firestore (one-time reads, admin only),
 * serializes it to a TournamentSnapshot JSON, and uploads it to Firebase Storage
 * at public-snapshots/{tournamentId}/latest.json.
 *
 * Participants fetch from that CDN URL — zero ongoing Firestore reads for them.
 */

import { ref } from 'vue';
import {
  db,
  storage,
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  updateDoc,
  query,
  where,
  serverTimestamp,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from '@/services/firebase';
import { useAuthStore } from '@/stores/auth';
import { convertTimestamps } from '@/utils/firestore';
import type {
  Tournament,
  Category,
  Match,
  Registration,
  Player,
  TbdScheduleEntry,
  TournamentSnapshot,
  CategorySnapshot,
  MatchSnapshot,
  PoolSnapshot,
  PlayerStanding,
  BracketSnapshot,
  BracketRound,
} from '@/types';
import { resolveParticipantName } from '@/composables/useLeaderboard';
import { buildPoolStandingsEntries, toPoolStandingsParticipants } from '@/utils/poolStandings';

// ── helpers ───────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function formatTime(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatScore(match: Match): string | undefined {
  if (!match.scores?.length) return undefined;
  return match.scores
    .map((g) => `${g.score1}–${g.score2}`)
    .join(', ');
}

function matchSnapshotStatus(match: Match): 'upcoming' | 'in_progress' | 'completed' {
  if (match.status === 'completed' || match.status === 'walkover') return 'completed';
  if (match.status === 'in_progress') return 'in_progress';
  return 'upcoming';
}

function roundLabel(match: Match): string | undefined {
  const pos = match.bracketPosition;
  if (!pos) return undefined;
  if (pos.bracket === 'finals') return 'Final';
  // Simple labelling — can be refined
  return undefined;
}

// Converts brackets-manager group_id to a human-readable "Pool A", "Pool B", etc.
function buildGroupLabelMap(groups: { id: string; name?: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  groups.forEach((g, i) => {
    map.set(g.id, g.name ?? `Pool ${String.fromCharCode(65 + i)}`);
  });
  return map;
}

// ── Firestore data helpers ────────────────────────────────────────────────────

async function fetchCategories(tournamentId: string): Promise<Category[]> {
  const snap = await getDocsFromServer(collection(db, `tournaments/${tournamentId}/categories`));
  return snap.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }) as Category);
}

async function fetchRegistrations(tournamentId: string): Promise<Registration[]> {
  const snap = await getDocsFromServer(collection(db, `tournaments/${tournamentId}/registrations`));
  return snap.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }) as Registration);
}

async function fetchPlayers(tournamentId: string): Promise<Player[]> {
  // Players are linked via registrations — fetch all referenced player IDs
  const regsSnap = await getDocsFromServer(
    query(
      collection(db, `tournaments/${tournamentId}/registrations`),
      where('status', 'in', ['approved', 'checked_in'])
    )
  );
  const playerIds = new Set<string>();
  regsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.playerId) playerIds.add(data.playerId);
    if (data.partnerPlayerId) playerIds.add(data.partnerPlayerId);
  });

  if (playerIds.size === 0) return [];

  // Firestore 'in' queries have a 30-item limit — batch if needed
  const ids = [...playerIds];
  const batches: Promise<Player[]>[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30);
    batches.push(
      getDocsFromServer(query(collection(db, 'players'), where('__name__', 'in', batch))).then((s) =>
        s.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }) as Player)
      )
    );
  }
  return (await Promise.all(batches)).flat();
}

async function fetchMatchesForScope(
  basePath: string,
  tournamentId: string,
  categoryId: string,
  levelId?: string,
): Promise<{ matches: Match[]; groups: { id: string; name?: string }[] }> {
  const [matchSnap, matchScoresSnap, participantSnap, groupSnap] = await Promise.all([
    getDocsFromServer(collection(db, `${basePath}/match`)),
    getDocsFromServer(collection(db, `${basePath}/match_scores`)),
    getDocsFromServer(collection(db, `${basePath}/participant`)),
    getDocsFromServer(collection(db, `${basePath}/group`)),
  ]);

  if (matchSnap.empty) {
    return { matches: [], groups: [] };
  }

  // Build participant id → registrationId map
  const participantMap = new Map<number, string>();
  participantSnap.docs.forEach((d) => {
    const data = d.data();
    // brackets-manager stores participantId as integer, name = registrationId
    if (data.id !== undefined && data.name) {
      participantMap.set(data.id, data.name);
    }
  });

  // Build match_scores map (keyed by match id)
  const scoresMap = new Map<string, Record<string, unknown>>();
  matchScoresSnap.docs.forEach((d) => scoresMap.set(d.id, d.data()));

  const groups = groupSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string | undefined }));

  const matches: Match[] = matchSnap.docs.map((d) => {
    const bm = d.data();
    const scores = scoresMap.get(d.id) ?? {};
    const p1RegId = bm.opponent1?.id !== undefined ? participantMap.get(bm.opponent1.id) : undefined;
    const p2RegId = bm.opponent2?.id !== undefined ? participantMap.get(bm.opponent2.id) : undefined;

    return convertTimestamps({
      id: d.id,
      tournamentId,
      categoryId,
      levelId,
      round: bm.round_id ?? 0,
      matchNumber: bm.number ?? 0,
      bracketPosition: {
        bracket: (scores as Record<string, unknown> & { bracketPosition?: { bracket?: string } }).bracketPosition?.bracket ?? 'winners',
        round: bm.round_id ?? 0,
        position: bm.number ?? 0,
      },
      participant1Id: p1RegId,
      participant2Id: p2RegId,
      winnerId: scores.winnerId,
      status: scores.status ?? 'upcoming',
      groupId: bm.group_id != null ? String(bm.group_id) : undefined,
      courtId: scores.courtId,
      plannedStartAt: scores.plannedStartAt,
      plannedEndAt: scores.plannedEndAt,
      scheduleStatus: scores.scheduleStatus,
      scores: scores.scores ?? [],
      ...scores,
    }) as Match;
  });

  return { matches, groups };
}

async function fetchTbdEntries(tournamentId: string): Promise<TbdScheduleEntry[]> {
  const snap = await getDocsFromServer(collection(db, `tournaments/${tournamentId}/tbdSchedule`));
  return snap.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }) as TbdScheduleEntry);
}

// ── Snapshot builders ─────────────────────────────────────────────────────────

function buildMatchSnapshot(
  match: Match,
  regMap: Map<string, Registration>,
  players: Player[],
  groupLabelMap: Map<string, string>,
  courts: Map<string, string>
): MatchSnapshot {
  const reg1 = match.participant1Id ? regMap.get(match.participant1Id) : undefined;
  const reg2 = match.participant2Id ? regMap.get(match.participant2Id) : undefined;

  return {
    id: match.id,
    time: formatTime(match.plannedStartAt),
    court: match.courtId ? courts.get(match.courtId) ?? match.courtId : undefined,
    player1: reg1 ? resolveParticipantName(reg1, players) : 'TBD',
    player2: reg2 ? resolveParticipantName(reg2, players) : 'TBD',
    status: matchSnapshotStatus(match),
    score: formatScore(match),
    poolLabel: match.groupId ? groupLabelMap.get(match.groupId) : undefined,
    round: roundLabel(match),
  };
}

function buildStandings(
  matches: Match[],
  registrations: Registration[],
  players: Player[]
): PlayerStanding[] {
  return buildPoolStandingsEntries(
    toPoolStandingsParticipants(
      registrations,
      (registration) => resolveParticipantName(registration, players),
    ),
    matches,
  ).map((entry, index) => ({
    rank: index + 1,
    name: entry.participantName,
    mp: entry.matchPoints,
    wins: entry.matchesWon,
    losses: entry.matchesLost,
    setWins: entry.gamesWon,
    setLosses: entry.gamesLost,
    ptsFor: entry.pointsFor,
    ptsAgainst: entry.pointsAgainst,
    pointsDiff: entry.pointDifference,
  }));
}

function buildPools(
  matches: Match[],
  groupLabelMap: Map<string, string>,
  regMap: Map<string, Registration>,
  players: Player[],
  courts: Map<string, string>
): PoolSnapshot[] {
  const poolMap = new Map<string, MatchSnapshot[]>();

  for (const match of matches) {
    if (!match.groupId) continue;
    const label = groupLabelMap.get(match.groupId) ?? `Group ${match.groupId}`;
    if (!poolMap.has(label)) poolMap.set(label, []);
    poolMap.get(label)!.push(buildMatchSnapshot(match, regMap, players, groupLabelMap, courts));
  }

  return [...poolMap.entries()].map(([label, ms]) => ({ label, matches: ms }));
}

function buildBracket(
  matches: Match[],
  regMap: Map<string, Registration>,
  players: Player[],
  groupLabelMap: Map<string, string>,
  courts: Map<string, string>,
): BracketSnapshot | undefined {
  const elimMatches = matches
    .filter((m) => !m.groupId)
    .sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);

  if (elimMatches.length === 0) return undefined;

  const roundMap = new Map<number, Match[]>();
  for (const m of elimMatches) {
    if (!roundMap.has(m.round)) roundMap.set(m.round, []);
    roundMap.get(m.round)!.push(m);
  }

  const sortedRounds = [...roundMap.keys()].sort((a, b) => a - b);
  const totalRounds = sortedRounds.length;

  const rounds: BracketRound[] = sortedRounds.map((roundNum, i) => {
    const remaining = totalRounds - i;
    let label: string;
    if (remaining === 1) label = 'Final';
    else if (remaining === 2) label = 'Semi Finals';
    else if (remaining === 3) label = 'Quarter Finals';
    else label = `Round ${roundNum}`;

    return {
      label,
      matches: roundMap.get(roundNum)!.map((m) =>
        buildMatchSnapshot(m, regMap, players, groupLabelMap, courts)
      ),
    };
  });

  return { rounds };
}

function buildCategorySnapshot(
  category: Category,
  matches: Match[],
  groups: { id: string; name?: string }[],
  registrations: Registration[],
  players: Player[],
  tbdEntries: TbdScheduleEntry[],
  courts: Map<string, string>
): CategorySnapshot {
  const catRegistrations = registrations.filter(
    (r) => r.categoryId === category.id && ['approved', 'checked_in'].includes(r.status)
  );
  const regMap = new Map(registrations.map((r) => [r.id, r]));
  const groupLabelMap = buildGroupLabelMap(groups);

  // All matches with at least one participant assigned (used for pools + bracket results)
  const publishedMatches = matches.filter(
    (m) => m.participant1Id || m.participant2Id
  );

  // Schedule tab: only explicitly published matches
  const scheduleMatches = publishedMatches.filter(
    (m) => m.scheduleStatus === 'published' || Boolean(m.publishedAt)
  );
  const schedule: MatchSnapshot[] = scheduleMatches
    .sort((a, b) => (a.plannedStartAt?.getTime() ?? 0) - (b.plannedStartAt?.getTime() ?? 0))
    .map((m) => buildMatchSnapshot(m, regMap, players, groupLabelMap, courts));

  // TBD auto-removal: for each roundLabel in tbdEntries, check if real matches exist for that round label
  const realRoundLabels = new Set(schedule.map((s) => s.round).filter(Boolean));
  const catTbdEntries = tbdEntries.filter((e) => e.categoryId === category.id || e.categoryId === '__all__');
  const survivingTbd = catTbdEntries.filter((e) => !realRoundLabels.has(e.roundLabel));

  const tbdSnapshots: MatchSnapshot[] = survivingTbd.map((e) => ({
    id: `tbd-${e.id}`,
    time: e.startTime,
    endTime: e.endTime,
    court: e.court,
    player1: 'TBD',
    player2: 'TBD',
    status: 'upcoming',
    round: e.roundLabel,
    isTbd: true,
  }));

  // Merge and sort
  const allSchedule = [...schedule, ...tbdSnapshots].sort((a, b) => {
    const parseTime = (t?: string) => {
      if (!t) return Infinity;
      const d = new Date(`1970/01/01 ${t}`);
      return isNaN(d.getTime()) ? Infinity : d.getTime();
    };
    return parseTime(a.time) - parseTime(b.time);
  });

  return {
    id: category.id,
    name: category.name,
    format: category.format,
    schedule: allSchedule,
    pools: buildPools(publishedMatches, groupLabelMap, regMap, players, courts),
    standings: buildStandings(matches, catRegistrations, players),
    bracket: buildBracket(publishedMatches, regMap, players, groupLabelMap, courts),
  };
}

// ── Composable ────────────────────────────────────────────────────────────────

export function usePublishSnapshot() {
  const authStore = useAuthStore();
  const publishing = ref(false);
  const error = ref<string | null>(null);

  async function publishSnapshot(tournamentId: string): Promise<string> {
    publishing.value = true;
    error.value = null;

    try {
      // 1. Load tournament
      const tournamentDoc = await getDoc(doc(db, `tournaments/${tournamentId}`));
      if (!tournamentDoc.exists()) throw new Error('Tournament not found');
      const tournament = convertTimestamps({ id: tournamentDoc.id, ...tournamentDoc.data() }) as Tournament;

      // 2. Ensure slug
      const slug =
        tournament.slug ??
        generateSlug(`${tournament.name} ${new Date(tournament.startDate).getFullYear()}`);

      // 3. Fetch all data in parallel
      const [categories, registrations, players, tbdEntries, courtsSnap] = await Promise.all([
        fetchCategories(tournamentId),
        fetchRegistrations(tournamentId),
        fetchPlayers(tournamentId),
        fetchTbdEntries(tournamentId),
        getDocsFromServer(collection(db, `tournaments/${tournamentId}/courts`)),
      ]);

      const courts = new Map<string, string>(
        courtsSnap.docs.map((d) => [d.id, (d.data().name as string) ?? d.id])
      );

      // 4. Fetch matches per category
      const categorySnapshots: CategorySnapshot[] = await Promise.all(
        categories.map(async (cat) => {
          const categoryPath = `tournaments/${tournamentId}/categories/${cat.id}`;
          const { matches, groups } = await fetchMatchesForScope(categoryPath, tournamentId, cat.id);

          return buildCategorySnapshot(
            cat,
            matches,
            groups,
            registrations,
            players,
            tbdEntries,
            courts,
          );
        })
      );

      // 5. Build snapshot
      const logoUrl = tournament.tournamentLogo?.url ?? undefined;

      const snapshot: TournamentSnapshot = {
        meta: {
          tournamentId,
          slug,
          name: tournament.name,
          sport: tournament.sport ?? undefined,
          startDate: tournament.startDate.toISOString(),
          endDate: tournament.endDate.toISOString(),
          location: tournament.location ?? undefined,
          logoUrl,
          pushedAt: new Date().toISOString(),
          pushedBy: authStore.currentUser?.id ?? '',
        },
        categories: categorySnapshots,
      };

      // 6. Upload to Storage
      const jsonBlob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
      const fileRef = storageRef(storage, `public-snapshots/${tournamentId}/latest.json`);
      await uploadBytes(fileRef, jsonBlob, {
        contentType: 'application/json',
        cacheControl: 'no-cache, max-age=0, must-revalidate',
      });
      const storageUrl = await getDownloadURL(fileRef);

      // 7. Update tournament document with snapshot metadata + slug
      await updateDoc(doc(db, `tournaments/${tournamentId}`), {
        slug,
        publicSnapshot: {
          pushedAt: serverTimestamp(),
          pushedBy: authStore.currentUser?.id ?? '',
          storageUrl,
        },
        updatedAt: serverTimestamp(),
      });

      return storageUrl;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to publish';
      throw e;
    } finally {
      publishing.value = false;
    }
  }

  return { publishing, error, publishSnapshot };
}
