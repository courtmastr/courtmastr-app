export type GridCellMatch = {
  id: string;
  courtId?: string | null;
  plannedStartAt?: Date;
  plannedEndAt?: Date;
  [key: string]: unknown;
};

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
