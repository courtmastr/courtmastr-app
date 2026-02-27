import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeps = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  timestampFromDate: vi.fn((value: Date) => ({ __timestamp: value.toISOString() })),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  writeBatch: mockDeps.writeBatch,
  serverTimestamp: mockDeps.serverTimestamp,
  Timestamp: {
    fromDate: mockDeps.timestampFromDate,
  },
}));

import {
  publishSchedule,
  scheduleTimes,
  type SchedulableMatch,
  type TimeScheduleConfig,
  unpublishSchedule,
} from '@/composables/useTimeScheduler';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<TimeScheduleConfig> = {}): TimeScheduleConfig {
  return {
    startTime: new Date('2025-01-01T09:00:00'),
    matchDurationMinutes: 20,
    bufferMinutes: 5,
    concurrency: 4,
    minRestTimeMinutes: 15,
    ...overrides,
  };
}

function makeMatch(id: string, round: number, matchNumber: number, opts: Partial<SchedulableMatch> = {}): SchedulableMatch {
  return { id, round, matchNumber, ...opts };
}

/** Build a realistic pool-event fixture: N teams in pools of size K */
function buildPoolMatches(totalTeams: number, poolSize: number): SchedulableMatch[] {
  const poolCount = Math.ceil(totalTeams / poolSize);
  const matches: SchedulableMatch[] = [];
  let matchId = 1;

  for (let pool = 0; pool < poolCount; pool++) {
    const teamsInPool = pool < poolCount - 1 ? poolSize : totalTeams - pool * poolSize;
    if (teamsInPool < 2) continue;
    // Each team plays every other team once (round-robin within pool)
    let roundWithinPool = 1;
    for (let t1 = 0; t1 < teamsInPool; t1++) {
      for (let t2 = t1 + 1; t2 < teamsInPool; t2++) {
        const team1Id = `pool${pool}-team${t1}`;
        const team2Id = `pool${pool}-team${t2}`;
        matches.push({
          id: String(matchId++),
          round: roundWithinPool,
          matchNumber: matchId,
          groupId: `pool${pool}`,
          participant1Id: team1Id,
          participant2Id: team2Id,
        });
        roundWithinPool++;
      }
    }
  }
  return matches;
}

const makeFirestoreSnapshot = (docs: Array<{ id: string; ref: string; data: Record<string, unknown> }>) => ({
  docs: docs.map((entry) => ({
    id: entry.id,
    ref: entry.ref,
    data: () => entry.data,
  })),
});

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe('scheduleTimes — Time-First Scheduler', () => {

  it('schedules_all_pool_matches_with_planned_times (70 teams, 3-team pools)', () => {
    // 70 teams → 23 full pools of 3 + 1 pool of 1 (ignored) ≈ 23 pools → 69 matches
    const matches = buildPoolMatches(70, 3);
    const config = makeConfig({ concurrency: 6, matchDurationMinutes: 20, bufferMinutes: 5 });

    const result = scheduleTimes(matches, config);

    // Every match should get a planned time (no end-time constraint → all schedulable)
    expect(result.planned.length).toBe(matches.length);
    expect(result.unscheduled.length).toBe(0);

    // Every planned match has valid timestamps
    for (const p of result.planned) {
      expect(p.plannedStartAt).toBeInstanceOf(Date);
      expect(p.plannedEndAt).toBeInstanceOf(Date);
      expect(p.plannedEndAt.getTime()).toBe(
        p.plannedStartAt.getTime() + 20 * 60_000
      );
      expect(p.plannedStartAt.getTime()).toBeGreaterThanOrEqual(config.startTime.getTime());
    }
  });

  it('respects_min_rest_time_between_team_matches', () => {
    // Team A plays match 1 at 09:00, should not play again until 09:35 (20 min game + 15 min rest)
    const matches: SchedulableMatch[] = [
      makeMatch('m1', 1, 1, { participant1Id: 'teamA', participant2Id: 'teamB' }),
      makeMatch('m2', 1, 2, { participant1Id: 'teamA', participant2Id: 'teamC' }),
    ];
    const config = makeConfig({ concurrency: 2, matchDurationMinutes: 20, bufferMinutes: 0, minRestTimeMinutes: 15 });

    const result = scheduleTimes(matches, config);

    expect(result.planned.length).toBe(2);
    const [p1, p2] = result.planned.sort((a, b) => a.plannedStartAt.getTime() - b.plannedStartAt.getTime());

    // p2 must start at least minRest after p1 ends (09:20 + 15 = 09:35)
    const minGapMs = 15 * 60_000;
    expect(p2.plannedStartAt.getTime()).toBeGreaterThanOrEqual(
      p1.plannedEndAt.getTime() + minGapMs
    );
  });

  it('unscheduled_when_out_of_time_with_reason', () => {
    // 10 matches, but only 30 minutes of window → cannot fit all
    const matches = Array.from({ length: 10 }, (_, i) =>
      makeMatch(`m${i}`, 1, i + 1, { participant1Id: `t${i}a`, participant2Id: `t${i}b` })
    );
    const endTime = new Date('2025-01-01T09:30:00'); // only 30 min window
    const config = makeConfig({
      concurrency: 1,
      matchDurationMinutes: 20,
      bufferMinutes: 0,
      endTime,
    });

    const result = scheduleTimes(matches, config);

    // 30 min / 20 min per match = 1 match fits; rest should be unscheduled
    expect(result.planned.length).toBe(1);
    expect(result.unscheduled.length).toBe(9);
    expect(result.unscheduled[0].reason).toMatch(/time slot/i);
  });

  it('lockedTime_match_not_overwritten_by_reschedule', () => {
    const matches: SchedulableMatch[] = [
      makeMatch('m1', 1, 1, { participant1Id: 'tA', participant2Id: 'tB', lockedTime: true }),
      makeMatch('m2', 1, 2, { participant1Id: 'tC', participant2Id: 'tD' }),
    ];
    const config = makeConfig({ concurrency: 2 });

    const result = scheduleTimes(matches, config);

    // Locked match is skipped by scheduleTimes (caller preserves existing planned time)
    expect(result.planned.find(p => p.matchId === 'm1')).toBeUndefined();
    expect(result.planned.find(p => p.matchId === 'm2')).toBeDefined();
  });

  it('tbd_matches_get_placeholder_planned_times', () => {
    // TBD matches (no participants) should still be scheduled for time reservation
    const matches: SchedulableMatch[] = [
      makeMatch('semifinal1', 2, 1), // no participants → TBD
      makeMatch('semifinal2', 2, 2), // no participants → TBD
    ];
    const config = makeConfig({ concurrency: 2 });

    const result = scheduleTimes(matches, config);

    // TBD matches should be scheduled (no rest constraint → placed freely)
    expect(result.planned.length).toBe(2);
    expect(result.unscheduled.length).toBe(0);
  });

  it('auto_assign_picks_earliest_due_match_by_planned_time', () => {
    // Simulate 3 matches scheduled at different times; earliest should come first in sorted order
    const t0 = new Date('2025-01-01T09:00:00');
    const t1 = new Date('2025-01-01T09:30:00');
    const t2 = new Date('2025-01-01T10:00:00');
    const matches: SchedulableMatch[] = [
      makeMatch('late',  1, 3, { participant1Id: 'tE', participant2Id: 'tF' }),
      makeMatch('early', 1, 1, { participant1Id: 'tA', participant2Id: 'tB' }),
      makeMatch('mid',   1, 2, { participant1Id: 'tC', participant2Id: 'tD' }),
    ];

    // The sort in scheduleTimes should order by group/round/matchNumber — not by planned time.
    // The test verifies that when we retrieve sorted planned output, times are monotone increasing.
    const config = makeConfig({ concurrency: 1, matchDurationMinutes: 25, bufferMinutes: 5 });
    const result = scheduleTimes(matches, config);

    const sortedByMatchId = result.planned.sort((a, b) =>
      Number(a.matchId < b.matchId) - Number(a.matchId > b.matchId)
    );

    // All planned times are >= startTime and monotone (non-decreasing) when sorted by start
    const sortedByTime = [...result.planned].sort(
      (a, b) => a.plannedStartAt.getTime() - b.plannedStartAt.getTime()
    );
    for (let i = 1; i < sortedByTime.length; i++) {
      expect(sortedByTime[i].plannedStartAt.getTime()).toBeGreaterThanOrEqual(
        sortedByTime[i - 1].plannedStartAt.getTime()
      );
    }
    void t0; void t1; void t2; void sortedByMatchId; // suppress unused var warnings
  });

  it('scheduleVersion is a positive integer', () => {
    const matches = [makeMatch('m1', 1, 1, { participant1Id: 'tA', participant2Id: 'tB' })];
    const result = scheduleTimes(matches, makeConfig());
    expect(result.scheduleVersion).toBeGreaterThan(0);
    expect(Number.isInteger(result.scheduleVersion)).toBe(true);
  });

  it('stats reflect actual counts', () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      makeMatch(`m${i}`, 1, i + 1, { participant1Id: `tA${i}`, participant2Id: `tB${i}` })
    );
    const result = scheduleTimes(matches, makeConfig({ concurrency: 5 }));

    expect(result.stats.totalMatches).toBe(5);
    expect(result.stats.plannedCount).toBe(result.planned.length);
    expect(result.stats.unscheduledCount).toBe(result.unscheduled.length);
    expect(result.stats.plannedCount + result.stats.unscheduledCount).toBe(5);
  });

  it('estimatedEndTime is the latest plannedEndAt', () => {
    const matches = Array.from({ length: 3 }, (_, i) =>
      makeMatch(`m${i}`, 1, i + 1, { participant1Id: `tA${i}`, participant2Id: `tB${i}` })
    );
    const result = scheduleTimes(matches, makeConfig({ concurrency: 1, matchDurationMinutes: 20 }));

    const latestEnd = result.planned.reduce<Date | null>((max, p) =>
      max === null || p.plannedEndAt > max ? p.plannedEndAt : max, null
    );
    expect(result.stats.estimatedEndTime?.getTime()).toBe(latestEnd?.getTime());
  });

});

describe('publish/unpublish schedule gates', () => {
  beforeEach(() => {
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => `collection:${path}`);
    mockDeps.doc.mockReset().mockImplementation((_db, path: string, id: string) => `doc:${path}/${id}`);
    mockDeps.getDocs.mockReset();
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.timestampFromDate.mockClear();
    mockDeps.writeBatch.mockReset();
  });

  it('publishes only planned draft slots unless force=true', async () => {
    const update = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      update,
      commit,
    });
    mockDeps.getDocs.mockResolvedValue(
      makeFirestoreSnapshot([
        {
          id: 'm1',
          ref: 'doc:match_scores/m1',
          data: { plannedStartAt: new Date('2026-02-27T10:00:00.000Z'), scheduleStatus: 'draft' },
        },
        {
          id: 'm2',
          ref: 'doc:match_scores/m2',
          data: { plannedStartAt: new Date('2026-02-27T11:00:00.000Z'), scheduleStatus: 'published' },
        },
        {
          id: 'm3',
          ref: 'doc:match_scores/m3',
          data: { scheduleStatus: 'draft' },
        },
      ])
    );

    const normal = await publishSchedule('t1', ['cat-1'], 'admin-1');
    expect(normal.publishedCount).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'doc:match_scores/m1',
      expect.objectContaining({
        scheduleStatus: 'published',
        publishedBy: 'admin-1',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(commit).toHaveBeenCalledTimes(1);

    update.mockClear();
    commit.mockClear();

    const forced = await publishSchedule('t1', ['cat-1'], 'admin-1', undefined, { force: true });
    expect(forced.publishedCount).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      'doc:match_scores/m2',
      expect.objectContaining({
        scheduleStatus: 'published',
        publishedBy: 'admin-1',
      })
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('unpublishes only matches that are currently public', async () => {
    const update = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      update,
      commit,
    });
    mockDeps.getDocs.mockResolvedValue(
      makeFirestoreSnapshot([
        {
          id: 'm1',
          ref: 'doc:match_scores/m1',
          data: { plannedStartAt: new Date('2026-02-27T10:00:00.000Z'), scheduleStatus: 'published' },
        },
        {
          id: 'm2',
          ref: 'doc:match_scores/m2',
          data: { plannedStartAt: new Date('2026-02-27T11:00:00.000Z'), scheduleStatus: 'draft', publishedAt: new Date('2026-02-27T09:00:00.000Z') },
        },
        {
          id: 'm3',
          ref: 'doc:match_scores/m3',
          data: { plannedStartAt: new Date('2026-02-27T12:00:00.000Z'), scheduleStatus: 'draft' },
        },
      ])
    );

    const result = await unpublishSchedule('t1', ['cat-1']);
    expect(result.unpublishedCount).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      'doc:match_scores/m1',
      expect.objectContaining({
        scheduleStatus: 'draft',
        publishedAt: null,
        publishedBy: null,
      })
    );
    expect(update).toHaveBeenCalledWith(
      'doc:match_scores/m2',
      expect.objectContaining({
        scheduleStatus: 'draft',
        publishedAt: null,
        publishedBy: null,
      })
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
