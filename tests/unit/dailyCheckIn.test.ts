import { describe, expect, it } from 'vitest';
import {
  computeResetTargets,
  formatDateKey,
  getTodayWindowUTC,
  type MatchForReset,
} from '../../functions/src/dailyCheckIn';

describe('formatDateKey', () => {
  it('returns YYYY-MM-DD in Chicago CDT (UTC-5)', () => {
    // 2026-04-15T00:30:00Z = 2026-04-14T19:30 Chicago CDT → still April 14
    const date = new Date('2026-04-15T00:30:00.000Z');
    expect(formatDateKey(date, 'America/Chicago')).toBe('2026-04-14');
  });

  it('rolls over to next day once past Chicago midnight', () => {
    // 2026-04-15T06:00:00Z = 2026-04-15T01:00 Chicago CDT → April 15
    const date = new Date('2026-04-15T06:00:00.000Z');
    expect(formatDateKey(date, 'America/Chicago')).toBe('2026-04-15');
  });
});

describe('getTodayWindowUTC', () => {
  it('window start is at Chicago midnight, window is 24h', () => {
    // At 06:00 UTC on April 15 (= 01:00 CDT), Chicago midnight was at 05:00 UTC
    const now = new Date('2026-04-15T06:00:00.000Z');
    const { windowStart, windowEnd } = getTodayWindowUTC(now, 'America/Chicago');

    // windowStart should be 2026-04-15T05:00:00Z (Chicago midnight CDT = UTC-5)
    expect(windowStart.toISOString()).toBe('2026-04-15T05:00:00.000Z');
    // windowEnd should be exactly 24h later
    expect(windowEnd.getTime() - windowStart.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('computeResetTargets', () => {
  const windowStart = new Date('2026-04-15T05:00:00.000Z');
  const windowEnd = new Date('2026-04-16T05:00:00.000Z');

  const makeMatch = (
    participant1Id: string | undefined,
    participant2Id: string | undefined,
    plannedStartAt: Date | null
  ): MatchForReset => ({ participant1Id, participant2Id, plannedStartAt });

  it('returns checked_in registration with a match in the window', () => {
    const matches = [makeMatch('reg-1', 'reg-2', new Date('2026-04-15T13:00:00.000Z'))];
    const statuses = new Map([
      ['reg-1', 'checked_in'],
      ['reg-2', 'approved'], // not resettable
    ]);
    expect(computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd }))
      .toEqual(['reg-1']);
  });

  it('includes no_show registrations', () => {
    const matches = [makeMatch('reg-3', undefined, new Date('2026-04-15T15:00:00.000Z'))];
    const statuses = new Map([['reg-3', 'no_show']]);
    expect(computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd }))
      .toEqual(['reg-3']);
  });

  it('excludes matches outside the window', () => {
    const matches = [makeMatch('reg-4', undefined, new Date('2026-04-16T13:00:00.000Z'))];
    const statuses = new Map([['reg-4', 'checked_in']]);
    expect(computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd }))
      .toEqual([]);
  });

  it('excludes matches with no plannedStartAt', () => {
    const matches = [makeMatch('reg-5', undefined, null)];
    const statuses = new Map([['reg-5', 'checked_in']]);
    expect(computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd }))
      .toEqual([]);
  });

  it('excludes pending, rejected, and withdrawn registrations', () => {
    const matches = [makeMatch('reg-6', 'reg-7', new Date('2026-04-15T13:00:00.000Z'))];
    const statuses = new Map([
      ['reg-6', 'pending'],
      ['reg-7', 'rejected'],
    ]);
    expect(computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd }))
      .toEqual([]);
  });

  it('handles both participants in the same match independently', () => {
    const matches = [makeMatch('reg-8', 'reg-9', new Date('2026-04-15T10:00:00.000Z'))];
    const statuses = new Map([
      ['reg-8', 'checked_in'],
      ['reg-9', 'no_show'],
    ]);
    const result = computeResetTargets({ matches, registrationStatuses: statuses, windowStart, windowEnd });
    expect(result.sort()).toEqual(['reg-8', 'reg-9']);
  });
});
