import { describe, expect, it } from 'vitest';
import type { Match } from '@/types';
import {
  buildDisplayCodeMap,
  buildGlobalMatchKey,
  getCategoryAlias,
} from '@/features/tournaments/utils/matchDisplayIdentity';

const baseDate = new Date('2026-01-01T09:00:00.000Z');

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-ms',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  status: 'scheduled',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

describe('getCategoryAlias', () => {
  it('returns expected aliases for standard badminton category names', () => {
    expect(getCategoryAlias("Men's Singles")).toBe('MS');
    expect(getCategoryAlias("Men's Doubles")).toBe('MD');
    expect(getCategoryAlias('Mixed Doubles')).toBe('MXD');
    expect(getCategoryAlias("Women's Singles")).toBe('WS');
    expect(getCategoryAlias("Women's Doubles")).toBe('WD');
  });
});

describe('buildGlobalMatchKey', () => {
  it('uses tournament, category, level scope, and match id', () => {
    expect(
      buildGlobalMatchKey(
        makeMatch({
          id: 'm-10',
          categoryId: 'cat-md',
          levelId: 'gold',
          tournamentId: 't-99',
        })
      )
    ).toBe('t-99:cat-md:gold:m-10');
  });

  it('falls back to base scope when levelId is missing', () => {
    expect(
      buildGlobalMatchKey(
        makeMatch({
          id: 'm-10',
          categoryId: 'cat-md',
          tournamentId: 't-99',
        })
      )
    ).toBe('t-99:cat-md:base:m-10');
  });
});

describe('buildDisplayCodeMap', () => {
  it('numbers matches independently inside each category', () => {
    const matches: Match[] = [
      makeMatch({ id: 'ms-a', categoryId: 'cat-ms', round: 1, matchNumber: 1 }),
      makeMatch({ id: 'ms-b', categoryId: 'cat-ms', round: 1, matchNumber: 2 }),
      makeMatch({ id: 'md-a', categoryId: 'cat-md', round: 1, matchNumber: 1 }),
    ];

    const map = buildDisplayCodeMap(matches, (categoryId) => {
      if (categoryId === 'cat-ms') return "Men's Singles";
      if (categoryId === 'cat-md') return "Men's Doubles";
      return categoryId;
    });

    expect(map.get(buildGlobalMatchKey(matches[0]))).toBe('MS1');
    expect(map.get(buildGlobalMatchKey(matches[1]))).toBe('MS2');
    expect(map.get(buildGlobalMatchKey(matches[2]))).toBe('MD1');
  });

  it('orders by round and matchNumber so finals get the last code', () => {
    const semiFinal = makeMatch({ id: 'm-semi', categoryId: 'cat-ms', round: 1, matchNumber: 1 });
    const final = makeMatch({ id: 'm-final', categoryId: 'cat-ms', round: 3, matchNumber: 1 });

    const map = buildDisplayCodeMap([final, semiFinal], () => "Men's Singles");

    expect(map.get(buildGlobalMatchKey(semiFinal))).toBe('MS1');
    expect(map.get(buildGlobalMatchKey(final))).toBe('MS2');
  });
});
