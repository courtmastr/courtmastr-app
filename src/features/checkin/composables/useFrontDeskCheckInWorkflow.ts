import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import type { Match, Registration } from '@/types';
import {
  isCheckInSearchableStatus,
  type CheckInSearchRow,
  type CheckInStatus,
} from '@/features/checkin/composables/checkInTypes';

export type ScanInput =
  | { kind: 'registration'; value: string }
  | { kind: 'bib'; value: number };

export const parseScanInput = (raw: string): ScanInput | null => {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('reg:')) {
    const registrationId = value.slice(4).trim();
    return registrationId ? { kind: 'registration', value: registrationId } : null;
  }

  if (/^\d+$/.test(value)) {
    return { kind: 'bib', value: Number(value) };
  }

  return { kind: 'registration', value };
};

export const assignSmallestAvailableBib = (usedBibs: number[], startFrom: number): number => {
  const used = new Set(usedBibs.filter((bib) => bib >= startFrom));
  let candidate = startFrom;

  while (used.has(candidate)) {
    candidate += 1;
  }

  return candidate;
};

export interface FrontDeskStatsInput {
  approved: number;
  checkedIn: number;
  noShow: number;
}

export interface FrontDeskStats {
  approvedTotal: number;
  checkedIn: number;
  noShow: number;
  ratePercent: number;
}

export interface FrontDeskThroughput {
  checkInsLastFiveMinutes: number;
  avgSecondsPerCheckIn: number;
}

export const computeFrontDeskStats = (input: FrontDeskStatsInput): FrontDeskStats => {
  const approvedTotal = input.approved + input.checkedIn + input.noShow;
  const ratePercent = approvedTotal > 0 ? Math.round((input.checkedIn / approvedTotal) * 100) : 0;

  return {
    approvedTotal,
    checkedIn: input.checkedIn,
    noShow: input.noShow,
    ratePercent,
  };
};

export interface BatchFailure {
  id: string;
  reason: string;
}

export interface BatchRunResult {
  successIds: string[];
  failed: BatchFailure[];
}

export const makeBatchRunner = (
  mutate: (registrationId: string) => Promise<void>
): ((registrationIds: string[]) => Promise<BatchRunResult>) => {
  return async (registrationIds: string[]): Promise<BatchRunResult> => {
    const successIds: string[] = [];
    const failed: BatchFailure[] = [];

    for (const registrationId of registrationIds) {
      try {
        await mutate(registrationId);
        successIds.push(registrationId);
      } catch (error) {
        failed.push({
          id: registrationId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successIds, failed };
  };
};

export interface ItemUndoToken {
  id: string;
  registrationId: string;
  createdAtMs: number;
  expiresAtMs: number;
  expiresInMs: number;
}

export interface BulkUndoToken {
  id: string;
  registrationIds: string[];
  createdAtMs: number;
  expiresAtMs: number;
  expiresInMs: number;
}

export interface UndoState {
  itemTokens: ItemUndoToken[];
  bulkTokens: BulkUndoToken[];
  startItemUndo: (registrationId: string, expiresInMs: number) => ItemUndoToken;
  startBulkUndo: (registrationIds: string[], expiresInMs: number) => BulkUndoToken;
}

const buildUndoTokenId = (): string => `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const createUndoState = (): UndoState => {
  const itemTokens: ItemUndoToken[] = [];
  const bulkTokens: BulkUndoToken[] = [];

  const startItemUndo = (registrationId: string, expiresInMs: number): ItemUndoToken => {
    const createdAtMs = Date.now();
    const token: ItemUndoToken = {
      id: buildUndoTokenId(),
      registrationId,
      createdAtMs,
      expiresAtMs: createdAtMs + expiresInMs,
      expiresInMs,
    };
    itemTokens.push(token);
    return token;
  };

  const startBulkUndo = (registrationIds: string[], expiresInMs: number): BulkUndoToken => {
    const createdAtMs = Date.now();
    const token: BulkUndoToken = {
      id: buildUndoTokenId(),
      registrationIds: [...registrationIds],
      createdAtMs,
      expiresAtMs: createdAtMs + expiresInMs,
      expiresInMs,
    };
    bulkTokens.push(token);
    return token;
  };

  return {
    itemTokens,
    bulkTokens,
    startItemUndo,
    startBulkUndo,
  };
};

export interface FrontDeskUrgentItem {
  id: string;
  title: string;
  subtitle: string;
  startsInLabel?: string;
  canCheckIn: boolean;
  disabledReason?: string;
}

export interface FrontDeskRecentItem {
  id: string;
  name: string;
  detail: string;
  canUndo: boolean;
  undoRemainingMs: number;
}

export interface FrontDeskBulkRow extends CheckInSearchRow {
  bibNumber?: number | null;
}

interface FrontDeskRecentRecord {
  id: string;
  name: string;
  bibNumber?: number | null;
  checkedInAtMs: number;
  undoExpiresAtMs: number;
}

export interface ProcessScanOptions {
  bibStartFrom?: number;
}

export interface ProcessScanResult {
  registrationId: string;
  name: string;
  bibNumber?: number | null;
}

export interface BulkCheckInResult extends BatchRunResult {
  bulkUndoToken: BulkUndoToken | null;
}

export interface UseFrontDeskCheckInWorkflowOptions {
  registrations: Ref<Registration[]>;
  matches: Ref<Match[]>;
  getParticipantName: (registrationId: string) => string;
  /** Individual player name lookup — used to expand doubles into per-player rows */
  getPlayerName?: (playerId: string) => string;
  getCategoryName: (categoryId: string) => string;
  checkInRegistration: (registrationId: string, participantId?: string) => Promise<void>;
  undoCheckInRegistration: (registrationId: string) => Promise<void>;
  assignBibNumber: (registrationId: string, bibNumber: number) => Promise<void>;
}

export interface TypedQueryCandidate {
  id: string;
}

export type TypedQueryMatchResult =
  | { type: 'match'; registrationId: string }
  | { type: 'ambiguous'; registrationIds: string[] }
  | { type: 'not_found' };

const formatTime = (date: Date): string => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatMinutesLabel = (minutes: number): string => {
  if (minutes <= 1) return 'Plays now';
  return `Plays in ${minutes} min`;
};

const getCheckInBlockedReason = (status: Registration['status'] | undefined): string => {
  if (status === 'checked_in') return 'Already checked in';
  if (status === 'no_show') return 'Marked as no-show';
  if (status === 'withdrawn') return 'Registration withdrawn';
  if (status === 'rejected') return 'Registration not approved';
  if (status === 'pending') return 'Pending approval';
  return 'Not eligible for check-in';
};

const getMatchStartTime = (match: Match): Date | undefined => match.plannedStartAt ?? match.scheduledTime;

interface CheckInEligibleRegistration extends Registration {
  status: CheckInStatus;
}

const isCheckInEligibleRegistration = (
  registration: Registration
): registration is CheckInEligibleRegistration =>
  isCheckInSearchableStatus(registration.status);

const normalizeText = (value: string): string => value.trim().toLowerCase();
const THROUGHPUT_WINDOW_MS = 5 * 60_000;

export const findRegistrationByTypedQuery = (
  query: string,
  registrations: readonly TypedQueryCandidate[],
  getParticipantName: (registrationId: string) => string
): TypedQueryMatchResult => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return { type: 'not_found' };

  const idMatch = registrations.find((registration) => normalizeText(registration.id) === normalizedQuery);
  if (idMatch) {
    return { type: 'match', registrationId: idMatch.id };
  }

  const matched = registrations.filter((registration) => normalizeText(getParticipantName(registration.id)).includes(normalizedQuery));
  if (matched.length === 0) return { type: 'not_found' };

  const exactNameMatches = matched.filter((registration) => normalizeText(getParticipantName(registration.id)) === normalizedQuery);
  if (exactNameMatches.length === 1) {
    return { type: 'match', registrationId: exactNameMatches[0].id };
  }

  if (matched.length === 1) {
    return { type: 'match', registrationId: matched[0].id };
  }

  return { type: 'ambiguous', registrationIds: matched.map((registration) => registration.id) };
};

export const useFrontDeskCheckInWorkflow = (
  options: UseFrontDeskCheckInWorkflowOptions
): {
  urgentItems: ComputedRef<FrontDeskUrgentItem[]>;
  recentItems: ComputedRef<FrontDeskRecentItem[]>;
  bulkRows: ComputedRef<FrontDeskBulkRow[]>;
  stats: ComputedRef<FrontDeskStats>;
  throughput: ComputedRef<FrontDeskThroughput>;
  bulkUndoToken: Ref<BulkUndoToken | null>;
  processScan: (raw: string, scanOptions?: ProcessScanOptions) => Promise<ProcessScanResult>;
  checkInOne: (registrationId: string, bibStartFrom?: number) => Promise<ProcessScanResult>;
  bulkCheckIn: (registrationIds: string[], bibStartFrom?: number) => Promise<BulkCheckInResult>;
  undoItem: (registrationId: string) => Promise<void>;
  undoLatest: () => Promise<void>;
  undoBulk: () => Promise<BatchRunResult>;
} => {
  const undoState = createUndoState();
  const nowMs = ref(Date.now());
  const recentRecords = ref<FrontDeskRecentRecord[]>([]);
  const checkInTimestamps = ref<number[]>([]);
  const bulkUndoToken = ref<BulkUndoToken | null>(null);

  let tickTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    tickTimer = setInterval(() => {
      nowMs.value = Date.now();
    }, 500);
  });

  onUnmounted(() => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  });

  const eligibleRegistrations = computed(() =>
    options.registrations.value.filter(isCheckInEligibleRegistration)
  );

  // ---------------------------------------------------------------------------
  // Per-player participant entries — doubles registrations expand to 2 rows
  // ---------------------------------------------------------------------------

  interface ParticipantEntry {
    /** Unique row key: playerId for both singles and doubles */
    id: string;
    registrationId: string;
    playerId: string;
    name: string;
    partnerName?: string; // set for doubles only
    categoryId: string;
    bibNumber?: number | null;
    /** Per-player status: 'checked_in' if this player is physically present */
    status: CheckInStatus;
    isDoubles: boolean;
  }

  const resolvePlayerName = (playerId: string, registrationId: string): string => {
    if (options.getPlayerName) return options.getPlayerName(playerId);
    // Fallback for backwards-compat (singles: registrationId→name works fine)
    return options.getParticipantName(registrationId);
  };

  const getPlayerStatusInReg = (
    reg: CheckInEligibleRegistration,
    playerId: string,
  ): CheckInStatus => {
    if (reg.status === 'checked_in' || reg.status === 'no_show') return reg.status;
    // Doubles partial: this player may already be physically present
    if (reg.participantPresence?.[playerId]) return 'checked_in';
    return 'approved';
  };

  const eligibleParticipants = computed<ParticipantEntry[]>(() => {
    const result: ParticipantEntry[] = [];
    for (const reg of eligibleRegistrations.value) {
      const isDoubles = !!reg.partnerPlayerId;
      if (!isDoubles) {
        const pid = reg.playerId ?? reg.id;
        result.push({
          id: pid,
          registrationId: reg.id,
          playerId: pid,
          name: resolvePlayerName(pid, reg.id),
          categoryId: reg.categoryId,
          bibNumber: reg.bibNumber,
          status: reg.status,
          isDoubles: false,
        });
      } else {
        const participantIds = [reg.playerId, reg.partnerPlayerId].filter(
          (id): id is string => Boolean(id),
        );
        for (const pid of participantIds) {
          const partnerId = participantIds.find((id) => id !== pid);
          const partnerName = partnerId && options.getPlayerName
            ? options.getPlayerName(partnerId)
            : undefined;
          result.push({
            id: pid,
            registrationId: reg.id,
            playerId: pid,
            name: options.getPlayerName ? options.getPlayerName(pid) : pid,
            partnerName,
            categoryId: reg.categoryId,
            bibNumber: reg.bibNumber,
            status: getPlayerStatusInReg(reg, pid),
            isDoubles: true,
          });
        }
      }
    }
    return result;
  });

  const stats = computed(() => {
    const approved = eligibleRegistrations.value.filter((registration) => registration.status === 'approved').length;
    const checkedIn = eligibleRegistrations.value.filter((registration) => registration.status === 'checked_in').length;
    const noShow = eligibleRegistrations.value.filter((registration) => registration.status === 'no_show').length;
    return computeFrontDeskStats({ approved, checkedIn, noShow });
  });

  const throughput = computed<FrontDeskThroughput>(() => {
    const windowStartMs = nowMs.value - THROUGHPUT_WINDOW_MS;
    const recentWindow = checkInTimestamps.value
      .filter((timestamp) => timestamp >= windowStartMs)
      .sort((a, b) => a - b);

    if (recentWindow.length < 2) {
      return {
        checkInsLastFiveMinutes: recentWindow.length,
        avgSecondsPerCheckIn: 0,
      };
    }

    const totalDurationMs = recentWindow[recentWindow.length - 1] - recentWindow[0];
    const avgSecondsPerCheckIn = Math.round(totalDurationMs / (recentWindow.length - 1) / 1000);

    return {
      checkInsLastFiveMinutes: recentWindow.length,
      avgSecondsPerCheckIn,
    };
  });

  const urgentItems = computed<FrontDeskUrgentItem[]>(() => {
    const now = nowMs.value;
    const windowEnd = now + 30 * 60_000;
    const byRegistration = new Map<string, { startAtMs: number; categoryId: string }>();

    for (const match of options.matches.value) {
      const start = getMatchStartTime(match);
      if (!start) continue;
      const startAtMs = start.getTime();
      if (startAtMs < now || startAtMs > windowEnd) continue;
      if (match.status === 'completed' || match.status === 'walkover' || match.status === 'cancelled') continue;

      const participantIds = [match.participant1Id, match.participant2Id].filter(Boolean) as string[];
      for (const registrationId of participantIds) {
        const existing = byRegistration.get(registrationId);
        if (!existing || startAtMs < existing.startAtMs) {
          byRegistration.set(registrationId, {
            startAtMs,
            categoryId: match.categoryId,
          });
        }
      }
    }

    return [...byRegistration.entries()]
      .map(([registrationId, data]) => {
        const registration = options.registrations.value.find((item) => item.id === registrationId);
        const canCheckIn = registration?.status === 'approved';
        const disabledReason = canCheckIn ? undefined : getCheckInBlockedReason(registration?.status);
        const minutesAway = Math.max(0, Math.ceil((data.startAtMs - now) / 60_000));
        return {
          id: registrationId,
          title: options.getParticipantName(registrationId),
          subtitle: `${formatTime(new Date(data.startAtMs))} • ${options.getCategoryName(data.categoryId)}`,
          startsInLabel: formatMinutesLabel(minutesAway),
          canCheckIn,
          disabledReason,
          startAtMs: data.startAtMs,
        };
      })
      .sort((a, b) => {
        if (a.startAtMs !== b.startAtMs) return a.startAtMs - b.startAtMs;
        if (a.canCheckIn !== b.canCheckIn) return a.canCheckIn ? -1 : 1;
        return a.title.localeCompare(b.title);
      })
      .map(({ startAtMs, ...item }) => item);
  });

  const recentItems = computed<FrontDeskRecentItem[]>(() =>
    recentRecords.value.map((record) => {
      const remaining = Math.max(0, record.undoExpiresAtMs - nowMs.value);
      const timeLabel = new Date(record.checkedInAtMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const bibLabel = record.bibNumber ? `Bib ${record.bibNumber}` : 'No bib';
      return {
        id: record.id,
        name: record.name,
        detail: `${bibLabel} • ${timeLabel}`,
        canUndo: remaining > 0,
        undoRemainingMs: remaining,
      };
    })
  );

  const bulkRows = computed<FrontDeskBulkRow[]>(() =>
    eligibleParticipants.value
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        partnerName: entry.partnerName ?? null,
        category: options.getCategoryName(entry.categoryId),
        bibNumber: entry.bibNumber,
        status: entry.status,
        playerId: entry.playerId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

const assignBibIfNeeded = async (
    registrationId: string,
    existingBibNumber: number | null | undefined,
    bibStartFrom: number,
  ): Promise<number | null> => {
    if (existingBibNumber && existingBibNumber > 0) return existingBibNumber;

    const usedBibs = eligibleRegistrations.value
      .map((item) => item.bibNumber)
      .filter((value): value is number => value != null && value > 0);
    const nextBib = assignSmallestAvailableBib(usedBibs, bibStartFrom);
    await options.assignBibNumber(registrationId, nextBib);
    return nextBib;
  };

  const pushRecentCheckIn = (entry: ParticipantEntry, bibNumber: number | null): void => {
    // Undo still operates at registration level (reverts the whole registration)
    const token = undoState.startItemUndo(entry.registrationId, 5000);
    const nextRecord: FrontDeskRecentRecord = {
      id: entry.registrationId,
      name: entry.name,
      bibNumber,
      checkedInAtMs: token.createdAtMs,
      undoExpiresAtMs: token.expiresAtMs,
    };

    recentRecords.value = [nextRecord, ...recentRecords.value.filter((record) => record.id !== entry.registrationId)].slice(0, 5);
    const minTimestamp = token.createdAtMs - THROUGHPUT_WINDOW_MS;
    checkInTimestamps.value = [
      ...checkInTimestamps.value.filter((timestamp) => timestamp >= minTimestamp),
      token.createdAtMs,
    ];
  };

  /**
   * Check in a single participant by their unique row ID.
   *
   * - For search-result rows (id = playerId): checks in that player only.
   *   Doubles registrations stay 'approved' until both partners are present.
   * - For urgent-item rows (id = registrationId): checks in the whole registration
   *   at once (all participants).
   */
  const checkInOne = async (id: string, bibStartFrom = 101): Promise<ProcessScanResult> => {
    // Resolve by playerId first (per-player search rows), then by registrationId (urgent items)
    let entry = eligibleParticipants.value.find((e) => e.playerId === id);
    const isPlayerLevel = !!entry;
    if (!entry) {
      entry = eligibleParticipants.value.find((e) => e.registrationId === id);
    }
    if (!entry) throw new Error('No matching participant for scanned code');
    if (entry.status === 'checked_in') throw new Error('Already checked in');
    if (entry.status !== 'approved') throw new Error('Only approved participants can be checked in');

    const bibNumber = await assignBibIfNeeded(entry.registrationId, entry.bibNumber, bibStartFrom);
    // Player-level doubles check-in passes participantId so only one partner is marked present.
    // Registration-level (urgent items, singles) passes no participantId → whole team.
    const participantId = isPlayerLevel && entry.isDoubles ? entry.playerId : undefined;
    await options.checkInRegistration(entry.registrationId, participantId);
    pushRecentCheckIn(entry, bibNumber);

    return {
      registrationId: entry.registrationId,
      name: entry.name,
      bibNumber,
    };
  };

  const processScan = async (raw: string, scanOptions: ProcessScanOptions = {}): Promise<ProcessScanResult> => {
    const parsed = parseScanInput(raw);
    if (!parsed) throw new Error('No matching participant for scanned code');

    let entry: ParticipantEntry | undefined;

    if (parsed.kind === 'bib') {
      const reg = eligibleRegistrations.value.find((r) => r.bibNumber === parsed.value);
      if (!reg) throw new Error('No matching participant for scanned code');
      // For bib scan, check in first available player of this registration
      entry = eligibleParticipants.value.find((e) => e.registrationId === reg.id && e.status === 'approved');
      if (!entry) throw new Error('Ambiguous bib number. Multiple participants found');
    } else {
      // Text / registration-ID input
      const query = normalizeText(parsed.value);

      // Exact registration-ID match → check in first available player
      const regIdMatch = eligibleParticipants.value.find((e) => normalizeText(e.registrationId) === query);
      if (regIdMatch) {
        const available = eligibleParticipants.value.find(
          (e) => e.registrationId === regIdMatch.registrationId && e.status === 'approved',
        );
        entry = available ?? regIdMatch;
      }

      if (!entry) {
        // Name match (per-player)
        const byName = eligibleParticipants.value.filter((e) =>
          normalizeText(e.name).includes(query),
        );
        if (byName.length === 0) throw new Error('No matching participant for scanned code');
        const exactMatches = byName.filter((e) => normalizeText(e.name) === query);
        if (exactMatches.length === 1) {
          entry = exactMatches[0];
        } else if (byName.length === 1) {
          entry = byName[0];
        } else {
          throw new Error(
            'Multiple participants match this name. Type more of the name or use bib number.',
          );
        }
      }
    }

    if (!entry) throw new Error('No matching participant for scanned code');
    return checkInOne(entry.id, scanOptions.bibStartFrom ?? 101);
  };

  const bulkCheckIn = async (registrationIds: string[], bibStartFrom = 101): Promise<BulkCheckInResult> => {
    const runBatch = makeBatchRunner(async (registrationId: string) => {
      await checkInOne(registrationId, bibStartFrom);
    });

    const result = await runBatch(registrationIds);
    bulkUndoToken.value = result.successIds.length > 0 ? undoState.startBulkUndo(result.successIds, 10000) : null;

    return {
      ...result,
      bulkUndoToken: bulkUndoToken.value,
    };
  };

  const undoItem = async (registrationId: string): Promise<void> => {
    const recent = recentItems.value.find((item) => item.id === registrationId);
    if (!recent) throw new Error('Undo target not found');
    if (!recent.canUndo) throw new Error('Undo window expired');

    await options.undoCheckInRegistration(registrationId);
    recentRecords.value = recentRecords.value.filter((record) => record.id !== registrationId);
  };

  const undoLatest = async (): Promise<void> => {
    const latestUndoable = recentItems.value.find((item) => item.canUndo);
    if (!latestUndoable) throw new Error('No recent check-in available to undo');
    await undoItem(latestUndoable.id);
  };

  const undoBulk = async (): Promise<BatchRunResult> => {
    if (!bulkUndoToken.value) throw new Error('No bulk undo available');
    if (bulkUndoToken.value.expiresAtMs <= nowMs.value) {
      bulkUndoToken.value = null;
      throw new Error('Bulk undo window expired');
    }

    const runBatch = makeBatchRunner(async (registrationId: string) => {
      await options.undoCheckInRegistration(registrationId);
    });

    const result = await runBatch(bulkUndoToken.value.registrationIds);
    bulkUndoToken.value = null;
    return result;
  };

  return {
    urgentItems,
    recentItems,
    bulkRows,
    stats,
    throughput,
    bulkUndoToken,
    processScan,
    checkInOne,
    bulkCheckIn,
    undoItem,
    undoLatest,
    undoBulk,
  };
};
