import { describe, expect, it } from 'vitest';
import { resolveMatches } from '@/composables/useLeaderboard';

describe('resolveMatches source-doc typing', () => {
  it('drops matches when participants cannot be resolved', () => {
    const result = resolveMatches(
      'cat-1',
      [
        { id: 1, name: 'reg-1' },
        { id: 2, name: 'reg-2' },
      ],
      [{ id: 'm-1', opponent1: { id: 1 }, opponent2: { id: 999 }, round: 1 }],
      [{ id: 'm-1', winnerId: 'reg-1', status: 'completed', scores: [] }]
    );

    expect(result).toEqual([]);
  });
});
