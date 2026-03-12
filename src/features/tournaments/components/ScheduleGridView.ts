export type GridCellMatch = {
  id: string;
  courtId?: string | null;
  plannedStartAt?: Date;
  plannedEndAt?: Date;
  [key: string]: unknown;
};

export interface DragParticipantMatch {
  id: string;
  participant1Id?: string;
  participant2Id?: string;
  plannedStartAt?: Date;
  plannedEndAt?: Date;
}

export interface DragContext {
  matchId: string;
  participant1Id?: string;
  participant2Id?: string;
  durationMs: number;
  allMatches: DragParticipantMatch[];
  timeSlots: Date[];
  courtIds: string[];
  minRestMs: number;
  intervalMinutes: number;
  cellMap: Map<string, GridCellValue>;
}

/**
 * Computes the set of valid drop target cell keys for a dragged match.
 * A cell key is "${slotIndex}:${courtIndex}".
 * A cell is valid when:
 *   1. It is empty (not occupied by any other match in cellMap)
 *   2. No participant of the dragged match plays another match overlapping the candidate window
 *   3. Both participants have >= minRestMs rest before/after all other matches they play
 */
export function computeValidDropTargets(ctx: DragContext): Set<string> {
  const {
    matchId,
    participant1Id,
    participant2Id,
    durationMs,
    allMatches,
    timeSlots,
    courtIds,
    minRestMs,
    intervalMinutes,
    cellMap,
  } = ctx;

  const participantIds = [participant1Id, participant2Id].filter(Boolean) as string[];

  // Build per-participant list of OTHER matches (excluding the one being dragged)
  const participantMatches = new Map<string, Array<{ startMs: number; endMs: number }>>();
  for (const pid of participantIds) {
    participantMatches.set(pid, []);
  }
  const fallbackDurationMs = intervalMinutes * 60_000;
  for (const m of allMatches) {
    if (m.id === matchId) continue;
    if (!m.plannedStartAt) continue;
    const startMs = m.plannedStartAt.getTime();
    const endMs = m.plannedEndAt?.getTime() ?? startMs + fallbackDurationMs;
    for (const pid of participantIds) {
      if (m.participant1Id === pid || m.participant2Id === pid) {
        participantMatches.get(pid)!.push({ startMs, endMs });
      }
    }
  }

  const valid = new Set<string>();

  for (let si = 0; si < timeSlots.length; si += 1) {
    const candidateStart = timeSlots[si].getTime();
    const candidateEnd = candidateStart + durationMs;

    for (let ci = 0; ci < courtIds.length; ci += 1) {
      const key = `${si}:${ci}`;
      const cell = cellMap.get(key);

      // Cell must be empty or be the dragged match itself
      if (cell !== undefined && cell !== null) {
        if (cell === 'continuation') continue;
        const cellMatch = cell as GridCellMatch;
        if (cellMatch.id !== matchId) continue;
      }

      // Skip if any participant has a conflict at this time
      if (participantIds.length === 0) {
        // TBD/no participants: all empty cells are valid
        valid.add(key);
        continue;
      }

      let conflict = false;
      for (const pid of participantIds) {
        const others = participantMatches.get(pid) ?? [];
        for (const other of others) {
          // Overlap check
          if (candidateStart < other.endMs && other.startMs < candidateEnd) {
            conflict = true;
            break;
          }
          // Rest-time check
          if (other.endMs <= candidateStart) {
            if (candidateStart - other.endMs < minRestMs) {
              conflict = true;
              break;
            }
          } else if (other.startMs >= candidateEnd) {
            if (other.startMs - candidateEnd < minRestMs) {
              conflict = true;
              break;
            }
          }
        }
        if (conflict) break;
      }

      if (!conflict) {
        valid.add(key);
      }
    }
  }

  return valid;
}

export type GridCellValue = GridCellMatch | 'continuation' | null;

export const computeTimeSlots = (
  start: Date,
  end: Date,
  intervalMinutes: number
): Date[] => {
  const slots: Date[] = [];
  const intervalMs = intervalMinutes * 60_000;
  for (let time = start.getTime(); time < end.getTime(); time += intervalMs) {
    slots.push(new Date(time));
  }
  return slots;
};

export const computeMatchRowSpan = (
  match: { plannedStartAt?: Date; plannedEndAt?: Date },
  intervalMinutes: number
): number => {
  if (!match.plannedStartAt || !match.plannedEndAt) return 1;
  const durationMs = match.plannedEndAt.getTime() - match.plannedStartAt.getTime();
  return Math.max(1, Math.ceil(durationMs / (intervalMinutes * 60_000)));
};

export const computeSlotIndex = (
  matchStartMs: number,
  gridStartMs: number,
  intervalMinutes: number
): number => {
  const intervalMs = intervalMinutes * 60_000;
  return Math.round((matchStartMs - gridStartMs) / intervalMs);
};

export const buildGridCellMap = (
  matches: GridCellMatch[],
  gridStart: Date,
  courtIds: string[],
  intervalMinutes: number
): Map<string, GridCellValue> => {
  const map = new Map<string, GridCellValue>();
  const fallbackDurationMs = intervalMinutes * 60_000;
  const laneEndTimesMs = Array(Math.max(0, courtIds.length)).fill(Number.NEGATIVE_INFINITY);

  const sortedMatches = [...matches].sort((a, b) => {
    const aStart = a.plannedStartAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bStart = b.plannedStartAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.plannedEndAt?.getTime() ?? aStart;
    const bEnd = b.plannedEndAt?.getTime() ?? bStart;
    return aEnd - bEnd;
  });

  const findFirstAvailableLane = (startMs: number): number => {
    for (let lane = 0; lane < laneEndTimesMs.length; lane += 1) {
      if (laneEndTimesMs[lane] <= startMs) {
        return lane;
      }
    }
    return -1;
  };

  const findEarliestEndingLane = (): number => {
    if (laneEndTimesMs.length === 0) return -1;
    let bestLane = 0;
    let bestEnd = laneEndTimesMs[0];
    for (let lane = 1; lane < laneEndTimesMs.length; lane += 1) {
      if (laneEndTimesMs[lane] < bestEnd) {
        bestLane = lane;
        bestEnd = laneEndTimesMs[lane];
      }
    }
    return bestLane;
  };

  for (const match of sortedMatches) {
    if (!match.plannedStartAt) continue;
    if (courtIds.length === 0) continue;

    const startMs = match.plannedStartAt.getTime();
    const endMs = match.plannedEndAt?.getTime() ?? (startMs + fallbackDurationMs);

    let courtIndex = match.courtId ? courtIds.indexOf(match.courtId) : -1;
    if (courtIndex === -1) {
      const availableLane = findFirstAvailableLane(startMs);
      courtIndex = availableLane !== -1 ? availableLane : findEarliestEndingLane();
    }
    if (courtIndex === -1) continue;

    const slotIndex = computeSlotIndex(
      match.plannedStartAt.getTime(),
      gridStart.getTime(),
      intervalMinutes
    );
    const rowSpan = computeMatchRowSpan(match, intervalMinutes);

    map.set(`${slotIndex}:${courtIndex}`, match);

    for (let offset = 1; offset < rowSpan; offset += 1) {
      map.set(`${slotIndex + offset}:${courtIndex}`, 'continuation');
    }

    laneEndTimesMs[courtIndex] = Math.max(laneEndTimesMs[courtIndex], endMs);
  }

  return map;
};
