import { describe, expect, it } from 'vitest';
import type { Match } from '@/types';
import {
  buildScheduleExportRows,
  formatExportTime,
} from '@/features/tournaments/utils/scheduleExport';

const t0 = new Date('2026-01-01T09:00:00.000Z');
const t30 = new Date('2026-01-01T09:30:00.000Z');
const t60 = new Date('2026-01-01T10:00:00.000Z');

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'p1',
  participant2Id: 'p2',
  status: 'scheduled',
  plannedStartAt: t0,
  plannedEndAt: t30,
  scheduleStatus: 'published',
  courtId: 'court-1',
  scores: [],
  createdAt: t0,
  updatedAt: t0,
  ...overrides,
});

describe('buildScheduleExportRows', () => {
  it('returns one row per scheduled match sorted by time', () => {
    const matches = [
      makeMatch({ id: 'm-2', plannedStartAt: t30, plannedEndAt: t60, matchNumber: 2 }),
      makeMatch({ id: 'm-1', plannedStartAt: t0, plannedEndAt: t30, matchNumber: 1 }),
    ];

    const rows = buildScheduleExportRows(
      matches,
      (id) => (id === 'cat-1' ? "Men's Singles" : id),
      (id) => (id === 'p1' ? 'Ali' : 'Bob'),
      (id) => (id === 'court-1' ? 'Court 1' : id ?? '')
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].matchId).toBe('m-1');
    expect(rows[1].matchId).toBe('m-2');
  });

  it('includes compact display code and stable global key', () => {
    const matches = [
      makeMatch({ id: 'm-1', categoryId: 'cat-ms', round: 1, matchNumber: 1 }),
      makeMatch({ id: 'm-2', categoryId: 'cat-ms', round: 2, matchNumber: 1 }),
    ];

    const rows = buildScheduleExportRows(
      matches,
      () => "Men's Singles",
      () => 'Player',
      () => 'Court'
    );

    expect(rows[0].displayCode).toBe('MS1');
    expect(rows[1].displayCode).toBe('MS2');
    expect(rows[0].globalMatchKey).toBe('t-1:cat-ms:base:m-1');
    expect(rows[1].globalMatchKey).toBe('t-1:cat-ms:base:m-2');
  });

  it('appends unscheduled matches at the bottom with empty time', () => {
    const matches = [
      makeMatch({ id: 'm-1', plannedStartAt: t0 }),
      makeMatch({ id: 'm-2', plannedStartAt: undefined, plannedEndAt: undefined }),
    ];

    const rows = buildScheduleExportRows(matches, () => 'Cat', () => 'Player', () => 'Court');

    expect(rows[0].matchId).toBe('m-1');
    expect(rows[1].matchId).toBe('m-2');
    expect(rows[1].plannedStartDisplay).toBe('');
  });

  it('includes duration in minutes', () => {
    const matches = [makeMatch({ plannedStartAt: t0, plannedEndAt: t30 })];
    const rows = buildScheduleExportRows(matches, () => 'Cat', () => 'P', () => 'C');
    expect(rows[0].durationMinutes).toBe(30);
  });
});

describe('formatExportTime', () => {
  it('formats time as HH:MM in local timezone representation', () => {
    expect(formatExportTime(t0)).toBeTruthy();
    expect(typeof formatExportTime(t0)).toBe('string');
  });

  it('returns empty string for undefined', () => {
    expect(formatExportTime(undefined)).toBe('');
  });
});
