import type { Match } from '@/types';
import type { ScheduledMatch } from '@/composables/useMatchScheduler';

export interface ScheduleScopeRef {
  categoryId: string;
  levelId?: string;
}

export interface ScheduleWindow {
  matchId: string;
  startMs: number;
  endMs: number;
}

export interface OccupiedScheduleWindow extends ScheduleWindow {
  categoryId: string;
  levelId?: string;
}

export interface CapacityConflict {
  conflictAtMs: number;
  nextBoundaryMs: number;
  requiredCapacity: number;
  availableCapacity: number;
}

interface BuildOccupiedWindowOptions {
  fallbackDurationMinutes: number;
  excludeScopes?: ScheduleScopeRef[];
}

const toScopeKey = (scope: ScheduleScopeRef): string => `${scope.categoryId}::${scope.levelId ?? ''}`;

const toEpochMs = (value: unknown): number | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  return null;
};

const isActiveAt = (window: ScheduleWindow, atMs: number): boolean =>
  window.startMs <= atMs && atMs < window.endMs;

const countActiveAt = (windows: ScheduleWindow[], atMs: number): number =>
  windows.reduce((count, window) => (isActiveAt(window, atMs) ? count + 1 : count), 0);

export function buildOccupiedWindows(
  matches: Match[],
  options: BuildOccupiedWindowOptions
): OccupiedScheduleWindow[] {
  const fallbackDurationMs = Math.max(1, options.fallbackDurationMinutes) * 60_000;
  const excludeScopeKeys = new Set((options.excludeScopes ?? []).map(toScopeKey));

  const windows: OccupiedScheduleWindow[] = [];
  for (const match of matches) {
    const isScheduledDraftOrPublished =
      match.scheduleStatus === 'draft'
      || match.scheduleStatus === 'published'
      || Boolean(match.publishedAt);
    if (!isScheduledDraftOrPublished) continue;

    const scopeKey = toScopeKey({ categoryId: match.categoryId, levelId: match.levelId });
    if (excludeScopeKeys.has(scopeKey)) continue;

    const startMs = toEpochMs(match.plannedStartAt ?? match.scheduledTime);
    if (startMs === null) continue;

    let endMs = toEpochMs(match.plannedEndAt);
    if (endMs === null || endMs <= startMs) {
      endMs = startMs + fallbackDurationMs;
    }
    if (endMs <= startMs) continue;

    windows.push({
      matchId: match.id,
      categoryId: match.categoryId,
      levelId: match.levelId,
      startMs,
      endMs,
    });
  }

  return windows.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function extractScheduledWindows(scheduled: ScheduledMatch[]): ScheduleWindow[] {
  const windows: ScheduleWindow[] = [];
  for (const entry of scheduled) {
    const startMs = toEpochMs(entry.scheduledTime);
    const endMs = toEpochMs(entry.estimatedEndTime);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    windows.push({
      matchId: entry.matchId,
      startMs,
      endMs,
    });
  }
  return windows.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function findCapacityConflict(
  occupied: ScheduleWindow[],
  candidate: ScheduleWindow[],
  availableCapacity: number
): CapacityConflict | null {
  if (candidate.length === 0) return null;

  const capacity = Math.max(0, Math.floor(availableCapacity));
  const boundaries = [...occupied, ...candidate]
    .flatMap((window) => [window.startMs, window.endMs])
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
    .filter((value, index, all) => index === 0 || value !== all[index - 1]);

  if (boundaries.length < 2) return null;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const conflictAtMs = boundaries[index];
    const nextBoundaryMs = boundaries[index + 1];
    if (nextBoundaryMs <= conflictAtMs) continue;

    const candidateCount = countActiveAt(candidate, conflictAtMs);
    if (candidateCount === 0) continue;

    const occupiedCount = countActiveAt(occupied, conflictAtMs);
    const requiredCapacity = occupiedCount + candidateCount;
    if (requiredCapacity > capacity) {
      return {
        conflictAtMs,
        nextBoundaryMs,
        requiredCapacity,
        availableCapacity: capacity,
      };
    }
  }

  return null;
}
