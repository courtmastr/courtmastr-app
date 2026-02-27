import { describe, expect, it } from 'vitest';
import {
  buildGridCellMap,
  computeMatchRowSpan,
  computeSlotIndex,
  computeTimeSlots,
  type GridCellMatch,
} from '@/features/tournaments/components/ScheduleGridView';

const BASE = new Date('2026-01-01T09:00:00.000Z').getTime();
const MIN_15 = 15 * 60_000;

describe('computeTimeSlots', () => {
  it('generates slots at 15-minute intervals', () => {
    const start = new Date(BASE);
    const end = new Date(BASE + MIN_15 * 4);
    const slots = computeTimeSlots(start, end, 15);

    expect(slots).toHaveLength(4);
    expect(slots[0].getTime()).toBe(BASE);
    expect(slots[1].getTime()).toBe(BASE + MIN_15);
    expect(slots[3].getTime()).toBe(BASE + MIN_15 * 3);
  });

  it('returns empty array when start equals end', () => {
    const same = new Date(BASE);
    expect(computeTimeSlots(same, same, 15)).toHaveLength(0);
  });
});

describe('computeMatchRowSpan', () => {
  it('calculates span for a 30-minute match on 15-minute slots as 2', () => {
    const match = {
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 30 * 60_000),
    };

    expect(computeMatchRowSpan(match, 15)).toBe(2);
  });

  it('returns 1 for a match shorter than one slot', () => {
    const match = {
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 10 * 60_000),
    };

    expect(computeMatchRowSpan(match, 15)).toBe(1);
  });
});

describe('computeSlotIndex', () => {
  it('returns 0 for a match starting at grid start', () => {
    expect(computeSlotIndex(BASE, BASE, 15)).toBe(0);
  });

  it('returns 2 for a match starting 30 minutes after grid start', () => {
    expect(computeSlotIndex(BASE + 30 * 60_000, BASE, 15)).toBe(2);
  });
});

describe('buildGridCellMap', () => {
  it('maps a match to the correct slot and court', () => {
    const gridStart = new Date(BASE);
    const match: GridCellMatch = {
      id: 'm-1',
      courtId: 'court-1',
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 30 * 60_000),
      scheduleStatus: 'published',
      categoryId: 'cat-1',
    };

    const map = buildGridCellMap([match], gridStart, ['court-1', 'court-2'], 15);

    expect((map.get('0:0') as GridCellMatch | undefined)?.id).toBe('m-1');
    expect(map.get('1:0')).toBe('continuation');
  });

  it('marks continuation cells for multi-slot matches', () => {
    const gridStart = new Date(BASE);
    const match: GridCellMatch = {
      id: 'm-1',
      courtId: 'court-1',
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 45 * 60_000),
    };

    const map = buildGridCellMap([match], gridStart, ['court-1'], 15);

    expect((map.get('0:0') as GridCellMatch | undefined)?.id).toBe('m-1');
    expect(map.get('1:0')).toBe('continuation');
    expect(map.get('2:0')).toBe('continuation');
  });

  it('places scheduled matches without courtId into inferred lanes', () => {
    const gridStart = new Date(BASE);
    const match: GridCellMatch = {
      id: 'm-no-court',
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 30 * 60_000),
    };

    const map = buildGridCellMap([match], gridStart, ['court-1', 'court-2'], 15);

    expect((map.get('0:0') as GridCellMatch | undefined)?.id).toBe('m-no-court');
    expect(map.get('1:0')).toBe('continuation');
  });

  it('spreads overlapping matches without courtId across lanes', () => {
    const gridStart = new Date(BASE);
    const matches: GridCellMatch[] = [
      {
        id: 'm-1',
        plannedStartAt: new Date(BASE),
        plannedEndAt: new Date(BASE + 30 * 60_000),
      },
      {
        id: 'm-2',
        plannedStartAt: new Date(BASE),
        plannedEndAt: new Date(BASE + 30 * 60_000),
      },
    ];

    const map = buildGridCellMap(matches, gridStart, ['court-1', 'court-2'], 15);

    expect((map.get('0:0') as GridCellMatch | undefined)?.id).toBe('m-1');
    expect((map.get('0:1') as GridCellMatch | undefined)?.id).toBe('m-2');
  });
});
