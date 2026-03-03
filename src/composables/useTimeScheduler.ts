/**
 * Time-First Scheduler for CourtMaster
 *
 * Assigns plannedStartAt / plannedEndAt to every match without requiring
 * court assignments.  Court assignment can happen later (manual or auto).
 *
 * Key concepts
 * ─────────────
 * concurrency  = number of simultaneous matches (defaults to active court count).
 *                Modelled as N "virtual slots", each with its own next-available time.
 * bufferMinutes = gap added after a match ends before the same virtual slot is reused.
 * lockedTime   = if true on a match_scores doc, the scheduler skips that match.
 */

import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from '@/services/firebase';

import { SCHEDULE_STATUS } from '@/scheduling/scheduleRules';
import type { UnscheduledMatch } from './useMatchScheduler';

// ============================================================
// Public Types
// ============================================================

export interface TimeScheduleConfig {
  startTime: Date;
  endTime?: Date;
  matchDurationMinutes: number;
  bufferMinutes: number;
  concurrency: number;
  minRestTimeMinutes: number;
}

export interface PlannedMatch {
  matchId: string;
  plannedStartAt: Date;
  plannedEndAt: Date;
}

export interface TimeScheduleResult {
  planned: PlannedMatch[];
  unscheduled: UnscheduledMatch[];
  scheduleVersion: number;
  stats: {
    totalMatches: number;
    plannedCount: number;
    unscheduledCount: number;
    estimatedEndTime: Date | null;
  };
}

export interface TimedScheduleScope {
  categoryId: string;
  levelId?: string;
}

// ============================================================
// Pure scheduling function (no Firebase, easily unit-tested)
// ============================================================

/**
 * A minimal match shape required by the scheduler.
 * Full Match objects also satisfy this.
 */
export interface SchedulableMatch {
  id: string;
  round: number;
  matchNumber: number;
  groupId?: string;       // pool / round-robin group identifier
  participant1Id?: string;
  participant2Id?: string;
  lockedTime?: boolean;
  plannedStartAt?: Date;  // existing planned time (skipped if lockedTime)
  schedulingEpoch?: number;
}

/**
 * Annotate each match with a `schedulingEpoch` using greedy player-conflict
 * graph coloring.  Epoch 0 = all matches where no participant has yet been
 * assigned a time slot.  Epoch N = matches whose participants last played at
 * epoch N-1.  Matches within the same epoch share no participants and can
 * therefore run concurrently without violating player rest.
 *
 * TBD matches (no participants) always receive epoch 0.
 */
export function computeEpochs(matches: SchedulableMatch[]): SchedulableMatch[] {
  // participantId → set of epochs already used by that participant
  const participantEpochs = new Map<string, Set<number>>();

  return matches.map(match => {
    const pids = [match.participant1Id, match.participant2Id].filter(Boolean) as string[];

    // Union of all epochs already used by either participant
    const usedEpochs = new Set<number>();
    for (const pid of pids) {
      const epochs = participantEpochs.get(pid);
      if (epochs) {
        for (const e of epochs) usedEpochs.add(e);
      }
    }

    // Smallest non-negative integer not in usedEpochs
    let epoch = 0;
    while (usedEpochs.has(epoch)) epoch++;

    // Record this epoch for each participant
    for (const pid of pids) {
      if (!participantEpochs.has(pid)) participantEpochs.set(pid, new Set());
      participantEpochs.get(pid)!.add(epoch);
    }

    return { ...match, schedulingEpoch: epoch };
  });
}

export function scheduleTimes(
  matches: SchedulableMatch[],
  config: TimeScheduleConfig
): TimeScheduleResult {
  const { startTime, matchDurationMinutes, bufferMinutes, concurrency, minRestTimeMinutes } = config;
  const endTime = config.endTime;
  const matchDurationMs = matchDurationMinutes * 60_000;
  const restMs = minRestTimeMinutes * 60_000;

  // N virtual slots, each tracks its next available start time
  const virtualSlots: number[] = Array(Math.max(1, concurrency)).fill(startTime.getTime());
  // participantId → their earliest next available (after rest)
  const teamRestMap = new Map<string, number>();

  const planned: PlannedMatch[] = [];
  const unscheduled: UnscheduledMatch[] = [];

  // Sort: epoch-first so all pool round-1 matches across all groups compete for courts
  // simultaneously before any round-2 match is considered.  When schedulingEpoch is absent
  // (undefined), the match sorts last within the epoch dimension and falls through to the
  // group-first stable tie-break — preserving existing behaviour for un-annotated callers.
  const sorted = [...matches].sort((a, b) => {
    const aEpoch = a.schedulingEpoch ?? Infinity;
    const bEpoch = b.schedulingEpoch ?? Infinity;
    if (aEpoch !== bEpoch) return aEpoch - bEpoch;
    // Within same epoch: pool matches (have groupId) before bracket matches (no groupId)
    const aIsPool = a.groupId !== undefined;
    const bIsPool = b.groupId !== undefined;
    if (aIsPool !== bIsPool) return aIsPool ? -1 : 1;
    // Stable tie-break: group order, then match number
    const aGroup = a.groupId ?? '\uffff';
    const bGroup = b.groupId ?? '\uffff';
    if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
    return a.matchNumber - b.matchNumber;
  });

  for (const match of sorted) {
    // Skip matches with lockedTime — preserve their existing planned times
    if (match.lockedTime) continue;

    const pids = [match.participant1Id, match.participant2Id].filter(Boolean) as string[];

    // 1. Earliest start from participant rest constraints
    let earliestStart = startTime.getTime();
    for (const pid of pids) {
      const lastEnd = teamRestMap.get(pid);
      if (lastEnd !== undefined) {
        const restEnd = lastEnd + restMs;
        if (restEnd > earliestStart) earliestStart = restEnd;
      }
    }

    // 2. Find virtual slot with earliest potential start >= earliestStart
    let bestSlotIdx = 0;
    let bestPotential = Math.max(virtualSlots[0], earliestStart);
    for (let i = 1; i < virtualSlots.length; i++) {
      const potential = Math.max(virtualSlots[i], earliestStart);
      if (potential < bestPotential) {
        bestPotential = potential;
        bestSlotIdx = i;
      }
    }

    const plannedStart = bestPotential;
    const plannedEnd = plannedStart + matchDurationMs;

    // 3. End-time boundary check
    if (endTime && plannedEnd > endTime.getTime()) {
      unscheduled.push({
        matchId: match.id,
        reason: `No available time slot before end of day (match would end at ${new Date(plannedEnd).toLocaleTimeString()})`,
        details: { estimatedEnd: new Date(plannedEnd), tournamentEnd: endTime },
      });
      continue;
    }

    // 4. Commit
    virtualSlots[bestSlotIdx] = plannedEnd + bufferMinutes * 60_000;
    for (const pid of pids) teamRestMap.set(pid, plannedEnd);
    planned.push({
      matchId: match.id,
      plannedStartAt: new Date(plannedStart),
      plannedEndAt: new Date(plannedEnd),
    });
  }

  const scheduleVersion = Math.floor(Date.now() / 1000);
  const estimatedEndTime = planned.length > 0
    ? planned.reduce<Date | null>((latest, m) =>
        latest === null || m.plannedEndAt > latest ? m.plannedEndAt : latest, null)
    : null;

  return {
    planned,
    unscheduled,
    scheduleVersion,
    stats: {
      totalMatches: matches.length,
      plannedCount: planned.length,
      unscheduledCount: unscheduled.length,
      estimatedEndTime,
    },
  };
}

// ============================================================
// Firestore helpers
// ============================================================

function getMatchScoresPath(
  tournamentId: string,
  categoryId: string,
  levelId?: string
): string {
  return levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
    : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
}

function hasScheduleMetadata(data: Record<string, unknown>): boolean {
  return (
    data.plannedStartAt != null
    || data.plannedEndAt != null
    || data.scheduledTime != null
    || data.scheduleStatus != null
    || data.scheduleVersion != null
    || data.publishedAt != null
    || data.publishedBy != null
  );
}

export async function clearTimedScheduleScopes(
  tournamentId: string,
  targets: TimedScheduleScope[]
): Promise<{ clearedCount: number }> {
  if (targets.length === 0) {
    return { clearedCount: 0 };
  }

  const batch = writeBatch(db);
  let clearedCount = 0;

  for (const target of targets) {
    const matchScoresPath = getMatchScoresPath(tournamentId, target.categoryId, target.levelId);
    const snap = await getDocs(collection(db, matchScoresPath));

    for (const scoreDoc of snap.docs) {
      const data = scoreDoc.data() as Record<string, unknown>;
      if (!hasScheduleMetadata(data)) continue;

      batch.update(scoreDoc.ref, {
        plannedStartAt: null,
        plannedEndAt: null,
        scheduledTime: null,
        scheduleStatus: null,
        scheduleVersion: null,
        publishedAt: null,
        publishedBy: null,
        updatedAt: serverTimestamp(),
      });
      clearedCount++;
    }
  }

  if (clearedCount > 0) {
    await batch.commit();
  }

  return { clearedCount };
}

/**
 * Persist a planned schedule to match_scores (batch write).
 * Does NOT touch courtId or scheduledTime (live-ops layer).
 * Skips matches whose match_scores doc already has lockedTime === true.
 */
export async function saveTimedSchedule(
  tournamentId: string,
  categoryId: string,
  result: TimeScheduleResult,
  levelId?: string,
  lockedMatchIds: Set<string> = new Set()
): Promise<void> {
  if (result.planned.length === 0) return;

  const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
  const batch = writeBatch(db);

  for (const slot of result.planned) {
    if (lockedMatchIds.has(slot.matchId)) continue;
    const scoreRef = doc(db, matchScoresPath, slot.matchId);
    batch.set(
      scoreRef,
      {
        plannedStartAt: Timestamp.fromDate(slot.plannedStartAt),
        plannedEndAt: Timestamp.fromDate(slot.plannedEndAt),
        scheduleVersion: result.scheduleVersion,
        scheduleStatus: SCHEDULE_STATUS.draft,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

/**
 * Publish: flip scheduleStatus from 'draft' → 'published' for all match_scores
 * that have a plannedStartAt in the given categories.
 */
export async function publishSchedule(
  tournamentId: string,
  categoryIds: string[],
  publishedBy: string,
  levelId?: string,
  options: { force?: boolean } = {}
): Promise<{ publishedCount: number }> {
  let publishedCount = 0;
  const batch = writeBatch(db);
  const force = options.force === true;

  for (const categoryId of categoryIds) {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const snap = await getDocs(collection(db, matchScoresPath));

    for (const d of snap.docs) {
      const data = d.data();
      if (data.plannedStartAt && (force || data.scheduleStatus !== SCHEDULE_STATUS.published)) {
        batch.update(d.ref, {
          scheduleStatus: SCHEDULE_STATUS.published,
          publishedAt: serverTimestamp(),
          publishedBy,
          updatedAt: serverTimestamp(),
        });
        publishedCount++;
      }
    }
  }

  await batch.commit();
  return { publishedCount };
}

/**
 * Unpublish: flip scheduleStatus from 'published' → 'draft' for match_scores
 * docs that currently expose a published schedule.
 */
export async function unpublishSchedule(
  tournamentId: string,
  categoryIds: string[],
  levelId?: string
): Promise<{ unpublishedCount: number }> {
  let unpublishedCount = 0;
  const batch = writeBatch(db);

  for (const categoryId of categoryIds) {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const snap = await getDocs(collection(db, matchScoresPath));

    for (const d of snap.docs) {
      const data = d.data();
      if (data.plannedStartAt && (data.scheduleStatus === SCHEDULE_STATUS.published || data.publishedAt)) {
        batch.update(d.ref, {
          scheduleStatus: SCHEDULE_STATUS.draft,
          publishedAt: null,
          publishedBy: null,
          updatedAt: serverTimestamp(),
        });
        unpublishedCount++;
      }
    }
  }

  await batch.commit();
  return { unpublishedCount };
}

// ============================================================
// Vue composable
// ============================================================

export function useTimeScheduler() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Run the time-first scheduler for a single category and persist results.
   * Returns locked match IDs so the caller can skip them.
   */
  async function scheduleCategory(
    tournamentId: string,
    categoryId: string,
    matches: SchedulableMatch[],
    config: TimeScheduleConfig,
    levelId?: string
  ): Promise<TimeScheduleResult> {
    loading.value = true;
    error.value = null;
    try {
      // Gather already-locked match IDs from match_scores
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      const snap = await getDocs(collection(db, matchScoresPath));
      const lockedMatchIds = new Set<string>();
      for (const d of snap.docs) {
        if (d.data().lockedTime === true) lockedMatchIds.add(d.id);
      }

      // Mark locked matches in input so scheduleTimes skips them
      const markedMatches = matches.map(m =>
        lockedMatchIds.has(m.id) ? { ...m, lockedTime: true } : m
      );

      const result = scheduleTimes(markedMatches, config);
      await saveTimedSchedule(tournamentId, categoryId, result, levelId, lockedMatchIds);
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Scheduling failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function publish(
    tournamentId: string,
    categoryIds: string[],
    publishedBy: string,
    levelId?: string,
    options: { force?: boolean } = {}
  ): Promise<{ publishedCount: number }> {
    loading.value = true;
    error.value = null;
    try {
      return await publishSchedule(tournamentId, categoryIds, publishedBy, levelId, options);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Publish failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function unpublish(
    tournamentId: string,
    categoryIds: string[],
    levelId?: string
  ): Promise<{ unpublishedCount: number }> {
    loading.value = true;
    error.value = null;
    try {
      return await unpublishSchedule(tournamentId, categoryIds, levelId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unpublish failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, scheduleCategory, publish, unpublish };
}
