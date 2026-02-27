import { describe, expect, it } from 'vitest';
import type { Category, Match } from '@/types';
import { resolveScheduleTargetsForCategory } from '@/scheduling/autoScheduleTargets';

const baseDate = new Date('2026-02-27T12:00:00.000Z');

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tournamentId: 't-1',
  name: "Men's Doubles",
  type: 'doubles',
  gender: 'men',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  seedingEnabled: true,
  status: 'active',
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: overrides.id || 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'r1',
  participant2Id: 'r2',
  status: 'ready',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

describe('resolveScheduleTargetsForCategory', () => {
  it('uses level scopes for generated pool-to-elimination categories with level matches', () => {
    const category = makeCategory({
      levelingStatus: 'generated',
    });
    const matches = [
      makeMatch({ id: 'base-complete', levelId: undefined, status: 'completed' }),
      makeMatch({ id: 'lvl-2-ready', levelId: 'level-2' }),
      makeMatch({ id: 'lvl-1-ready', levelId: 'level-1' }),
      makeMatch({ id: 'lvl-2-ready-2', levelId: 'level-2' }),
    ];

    const targets = resolveScheduleTargetsForCategory(category, matches);

    expect(targets).toEqual([
      { categoryId: 'cat-1', levelId: 'level-1' },
      { categoryId: 'cat-1', levelId: 'level-2' },
    ]);
  });

  it('falls back to base category scope when no level matches exist', () => {
    const category = makeCategory({
      levelingStatus: 'generated',
    });
    const matches = [makeMatch({ id: 'base-ready' })];

    const targets = resolveScheduleTargetsForCategory(category, matches);

    expect(targets).toEqual([{ categoryId: 'cat-1' }]);
  });

  it('falls back to base scope for non pool-to-elimination formats', () => {
    const category = makeCategory({
      format: 'single_elimination',
      levelingStatus: 'generated',
    });
    const matches = [
      makeMatch({ id: 'lvl-1-ready', levelId: 'level-1' }),
      makeMatch({ id: 'lvl-2-ready', levelId: 'level-2' }),
    ];

    const targets = resolveScheduleTargetsForCategory(category, matches);

    expect(targets).toEqual([{ categoryId: 'cat-1' }]);
  });
});
