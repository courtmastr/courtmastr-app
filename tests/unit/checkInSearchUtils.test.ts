import { describe, expect, it } from 'vitest';
import { normalizeCheckInQuery, rankItemsByQuery } from '@/features/checkin/composables/checkInSearchUtils';

describe('checkInSearchUtils', () => {
  it('normalizes query text with trim and lowercase', () => {
    expect(normalizeCheckInQuery('  AAnYa  ')).toBe('aanya');
  });

  it('ranks exact and prefix matches ahead of broad contains matches', () => {
    const items = [
      { id: 'r1', name: 'Tejas Mayavanshi' },
      { id: 'r2', name: 'Aanya Karthik' },
      { id: 'r3', name: 'Karthik Aanya' },
    ];

    const ranked = rankItemsByQuery({
      items,
      query: 'aanya',
      getSearchText: (item) => item.name,
    });

    expect(ranked.map((item) => item.id)).toEqual(['r2', 'r3']);
  });
});
