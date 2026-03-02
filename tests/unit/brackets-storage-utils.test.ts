import { describe, expect, it } from 'vitest';
import {
  normalizeReferences,
  removeUndefinedDeep,
} from '@/services/brackets-storage-utils';

describe('brackets-storage-utils', () => {
  it('removes undefined keys deeply', () => {
    expect(removeUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } })).toEqual({
      a: 1,
      c: { e: 2 },
    });
  });

  it('normalizes *_id object references to string ids', () => {
    expect(normalizeReferences({ stage_id: { id: 3 }, round_id: 2, name: 'R1' })).toEqual({
      stage_id: '3',
      round_id: 2,
      name: 'R1',
    });
  });
});
