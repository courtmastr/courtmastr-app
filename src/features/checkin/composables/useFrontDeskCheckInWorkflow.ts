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
  getCategoryName: (categoryId: string) => string;
  checkInRegistration: (registrationId: string) => Promise<void>;
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
  bulkUndoToken: Ref<BulkUndoToken | null>;
  processScan: (raw: string, scanOptions?: ProcessScanOptions) => Promise<ProcessScanResult>;
  checkInOne: (registrationId: string, bibStartFrom?: number) => Promise<ProcessScanResult>;
  bulkCheckIn: (registrationIds: string[], bibStartFrom?: number) => Promise<BulkCheckInResult>;
  undoItem: (registrationId: string) => Promise<void>;
  undoBulk: () => Promise<BatchRunResult>;
} => {
  const undoState = createUndoState();
  const nowMs = ref(Date.now());
  const recentRecords = ref<FrontDeskRecentRecord[]>([]);
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

  const stats = computed(() => {
    const approved = eligibleRegistrations.value.filter((registration) => registration.status === 'approved').length;
    const checkedIn = eligibleRegistrations.value.filter((registration) => registration.status === 'checked_in').length;
    const noShow = eligibleRegistrations.value.filter((registration) => registration.status === 'no_show').length;
    return computeFrontDeskStats({ approved, checkedIn, noShow });
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
        if (a.canCheckIn !== b.canCheckIn) return a.canCheckIn ? -1 : 1;
        return a.startAtMs - b.startAtMs;
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
    eligibleRegistrations.value
      .map((registration) => ({
        id: registration.id,
        name: options.getParticipantName(registration.id),
        category: options.getCategoryName(registration.categoryId),
        bibNumber: registration.bibNumber,
        status: registration.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  const resolveRegistration = (raw: string): CheckInEligibleRegistration => {
    const parsed = parseScanInput(raw);
    if (!parsed) throw new Error('No matching participant for scanned code');

    if (parsed.kind === 'registration') {
      const registration = eligibleRegistrations.value.find((item) => item.id === parsed.value);
      if (registration) return registration;

      const typedMatch = findRegistrationByTypedQuery(
        parsed.value,
        eligibleRegistrations.value,
        options.getParticipantName
      );
      if (typedMatch.type === 'match') {
        const matchedRegistration = eligibleRegistrations.value.find((item) => item.id === typedMatch.registrationId);
        if (matchedRegistration) return matchedRegistration;
      }
      if (typedMatch.type === 'ambiguous') {
        throw new Error('Multiple participants match this name. Type more of the name or use bib number.');
      }
      throw new Error('No matching participant for scanned code');
    }

    const candidates = eligibleRegistrations.value.filter((item) => item.bibNumber === parsed.value);
    if (candidates.length === 0) throw new Error('No matching participant for scanned code');
    if (candidates.length > 1) throw new Error('Ambiguous bib number. Multiple participants found');
    return candidates[0];
  };

  const assignBibIfNeeded = async (
    registration: CheckInEligibleRegistration,
    bibStartFrom: number
  ): Promise<number | null> => {
    if (registration.bibNumber && registration.bibNumber > 0) return registration.bibNumber;

    const usedBibs = eligibleRegistrations.value
      .map((item) => item.bibNumber)
      .filter((value): value is number => value != null && value > 0);
    const nextBib = assignSmallestAvailableBib(usedBibs, bibStartFrom);
    await options.assignBibNumber(registration.id, nextBib);
    return nextBib;
  };

  const pushRecentCheckIn = (registration: CheckInEligibleRegistration, bibNumber: number | null): void => {
    const token = undoState.startItemUndo(registration.id, 5000);
    const nextRecord: FrontDeskRecentRecord = {
      id: registration.id,
      name: options.getParticipantName(registration.id),
      bibNumber,
      checkedInAtMs: token.createdAtMs,
      undoExpiresAtMs: token.expiresAtMs,
    };

    recentRecords.value = [nextRecord, ...recentRecords.value.filter((record) => record.id !== registration.id)].slice(0, 5);
  };

  const checkInOne = async (registrationId: string, bibStartFrom = 101): Promise<ProcessScanResult> => {
    const registration = eligibleRegistrations.value.find((item) => item.id === registrationId);
    if (!registration) throw new Error('No matching participant for scanned code');
    if (registration.status === 'checked_in') throw new Error('Already checked in');
    if (registration.status !== 'approved') throw new Error('Only approved participants can be checked in');

    const bibNumber = await assignBibIfNeeded(registration, bibStartFrom);
    await options.checkInRegistration(registration.id);
    pushRecentCheckIn(registration, bibNumber);

    return {
      registrationId: registration.id,
      name: options.getParticipantName(registration.id),
      bibNumber,
    };
  };

  const processScan = async (raw: string, scanOptions: ProcessScanOptions = {}): Promise<ProcessScanResult> => {
    const registration = resolveRegistration(raw);
    return checkInOne(registration.id, scanOptions.bibStartFrom ?? 101);
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
    bulkUndoToken,
    processScan,
    checkInOne,
    bulkCheckIn,
    undoItem,
    undoBulk,
  };
};
