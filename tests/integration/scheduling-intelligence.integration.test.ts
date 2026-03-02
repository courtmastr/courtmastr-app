import { describe, expect, it } from 'vitest';
import { scheduleTimes, type SchedulableMatch } from '@/composables/useTimeScheduler';
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
} from '@/scheduling/scheduleCapacityGuard';
import type { Match } from '@/types';

const BASE = new Date('2026-02-27T09:00:00.000Z');

const makeSchedulable = (
  id: string,
  round: number,
  matchNumber: number,
  overrides: Partial<SchedulableMatch> = {}
): SchedulableMatch => ({
  id,
  round,
  matchNumber,
  participant1Id: `p1-${id}`,
  participant2Id: `p2-${id}`,
  ...overrides,
});

const makePlannedMatch = (overrides: Partial<Match> = {}): Match => ({
  id: overrides.id ?? 'occ-1',
  tournamentId: 't-1',
  categoryId: overrides.categoryId ?? 'cat-other',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: overrides.participant1Id ?? 'reg-1',
  participant2Id: overrides.participant2Id ?? 'reg-2',
  status: overrides.status ?? 'scheduled',
  scheduleStatus: overrides.scheduleStatus ?? 'published',
  plannedStartAt: overrides.plannedStartAt ?? new Date('2026-02-27T09:00:00.000Z'),
  plannedEndAt: overrides.plannedEndAt ?? new Date('2026-02-27T09:20:00.000Z'),
  scores: [],
  createdAt: overrides.createdAt ?? BASE,
  updatedAt: overrides.updatedAt ?? BASE,
  ...overrides,
});

describe('scheduling intelligence integration', () => {
  it('avoids over-capacity overlap across categories by shifting to next available boundary', () => {
    const occupied = buildOccupiedWindows(
      [
        makePlannedMatch({
          id: 'cat-b-slot',
          categoryId: 'cat-b',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'published',
        }),
      ],
      { fallbackDurationMinutes: 20 }
    );

    const catAMatches: SchedulableMatch[] = [
      makeSchedulable('cat-a-m1', 1, 1, { participant1Id: 'a1', participant2Id: 'a2' }),
      makeSchedulable('cat-a-m2', 1, 2, { participant1Id: 'a3', participant2Id: 'a4' }),
    ];

    const initialPlan = scheduleTimes(catAMatches, {
      startTime: new Date('2026-02-27T09:00:00.000Z'),
      matchDurationMinutes: 20,
      bufferMinutes: 0,
      concurrency: 1,
      minRestTimeMinutes: 15,
    });

    const candidate = extractScheduledWindows(
      initialPlan.planned.map((slot, index) => ({
        matchId: slot.matchId,
        courtId: '',
        courtNumber: 0,
        scheduledTime: slot.plannedStartAt,
        estimatedEndTime: slot.plannedEndAt,
        sequence: index + 1,
      }))
    );

    const conflict = findCapacityConflict(occupied, candidate, 1);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictAtMs).toBe(new Date('2026-02-27T09:00:00.000Z').getTime());
    expect(conflict?.nextBoundaryMs).toBe(new Date('2026-02-27T09:20:00.000Z').getTime());

    const shiftedPlan = scheduleTimes(catAMatches, {
      startTime: new Date(conflict!.nextBoundaryMs),
      matchDurationMinutes: 20,
      bufferMinutes: 0,
      concurrency: 1,
      minRestTimeMinutes: 15,
    });

    expect(shiftedPlan.planned[0].plannedStartAt.getTime()).toBe(new Date('2026-02-27T09:20:00.000Z').getTime());
  });

  it('prevents the same player from being scheduled back-to-back even across categories', () => {
    const matches: SchedulableMatch[] = [
      makeSchedulable('cat-a-m1', 1, 1, {
        participant1Id: 'shared-player',
        participant2Id: 'a-opponent',
      }),
      makeSchedulable('cat-b-m1', 1, 2, {
        participant1Id: 'shared-player',
        participant2Id: 'b-opponent',
      }),
    ];

    const result = scheduleTimes(matches, {
      startTime: new Date('2026-02-27T09:00:00.000Z'),
      matchDurationMinutes: 20,
      bufferMinutes: 0,
      concurrency: 2,
      minRestTimeMinutes: 15,
    });

    expect(result.planned).toHaveLength(2);

    const first = result.planned.find((slot) => slot.matchId === 'cat-a-m1');
    const second = result.planned.find((slot) => slot.matchId === 'cat-b-m1');
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const minGapMs = 15 * 60_000;
    expect(second!.plannedStartAt.getTime()).toBeGreaterThanOrEqual(
      first!.plannedEndAt.getTime() + minGapMs
    );
  });
});
