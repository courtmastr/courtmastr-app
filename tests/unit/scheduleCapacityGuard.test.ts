import { describe, expect, it } from 'vitest';
import type { Match } from '@/types';
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
} from '@/features/tournaments/dialogs/scheduleCapacityGuard';

const baseDate = new Date('2026-02-27T09:00:00.000Z');

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: overrides.id || 'm-1',
  tournamentId: 't-1',
  categoryId: overrides.categoryId || 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'r1',
  participant2Id: 'r2',
  status: 'scheduled',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

describe('scheduleCapacityGuard', () => {
  it('detects conflict when draft/published occupancy + candidate exceeds court capacity', () => {
    const occupied = buildOccupiedWindows(
      [
        makeMatch({
          id: 'occ-draft',
          categoryId: 'cat-other',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'draft',
        }),
        makeMatch({
          id: 'occ-published',
          categoryId: 'cat-other',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'published',
        }),
      ],
      {
        fallbackDurationMinutes: 20,
      }
    );

    const candidate = extractScheduledWindows([
      {
        matchId: 'cand-1',
        courtId: '',
        courtNumber: 0,
        scheduledTime: new Date('2026-02-27T09:00:00.000Z'),
        estimatedEndTime: new Date('2026-02-27T09:20:00.000Z'),
        sequence: 1,
      },
    ]);

    const conflict = findCapacityConflict(occupied, candidate, 2);

    expect(conflict).not.toBeNull();
    expect(conflict?.conflictAtMs).toBe(new Date('2026-02-27T09:00:00.000Z').getTime());
    expect(conflict?.nextBoundaryMs).toBe(new Date('2026-02-27T09:20:00.000Z').getTime());
  });

  it('returns no conflict when remaining capacity is enough', () => {
    const occupied = buildOccupiedWindows(
      [
        makeMatch({
          id: 'occ-1',
          categoryId: 'cat-other',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'published',
        }),
      ],
      {
        fallbackDurationMinutes: 20,
      }
    );

    const candidate = extractScheduledWindows([
      {
        matchId: 'cand-1',
        courtId: '',
        courtNumber: 0,
        scheduledTime: new Date('2026-02-27T09:00:00.000Z'),
        estimatedEndTime: new Date('2026-02-27T09:20:00.000Z'),
        sequence: 1,
      },
    ]);

    const conflict = findCapacityConflict(occupied, candidate, 2);
    expect(conflict).toBeNull();
  });

  it('treats boundary touch as non-overlap (end == start)', () => {
    const occupied = buildOccupiedWindows(
      [
        makeMatch({
          id: 'occ-1',
          categoryId: 'cat-other',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'draft',
        }),
      ],
      {
        fallbackDurationMinutes: 20,
      }
    );

    const candidate = extractScheduledWindows([
      {
        matchId: 'cand-1',
        courtId: '',
        courtNumber: 0,
        scheduledTime: new Date('2026-02-27T09:20:00.000Z'),
        estimatedEndTime: new Date('2026-02-27T09:40:00.000Z'),
        sequence: 1,
      },
    ]);

    expect(findCapacityConflict(occupied, candidate, 1)).toBeNull();
  });

  it('excludes same scheduling scope when building occupied windows', () => {
    const occupied = buildOccupiedWindows(
      [
        makeMatch({
          id: 'self-window',
          categoryId: 'cat-1',
          levelId: 'level-1',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'draft',
        }),
        makeMatch({
          id: 'other-window',
          categoryId: 'cat-2',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'draft',
        }),
      ],
      {
        fallbackDurationMinutes: 20,
        excludeScopes: [{ categoryId: 'cat-1', levelId: 'level-1' }],
      }
    );

    expect(occupied.map((window) => window.matchId)).toEqual(['other-window']);
  });

  it('uses fallback duration when plannedEndAt is missing', () => {
    const occupied = buildOccupiedWindows(
      [
        makeMatch({
          id: 'occ-fallback',
          categoryId: 'cat-other',
          plannedStartAt: new Date('2026-02-27T09:10:00.000Z'),
          plannedEndAt: undefined,
          scheduleStatus: 'published',
        }),
      ],
      {
        fallbackDurationMinutes: 30,
      }
    );

    expect(occupied).toHaveLength(1);
    expect(occupied[0].endMs).toBe(new Date('2026-02-27T09:40:00.000Z').getTime());
  });
});
