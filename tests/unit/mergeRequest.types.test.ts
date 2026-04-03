import { describe, it, expectTypeOf } from 'vitest';
import type { MergeRequest, MergeRequestStatus } from '@/types';

describe('MergeRequest type', () => {
  it('has the expected status union', () => {
    expectTypeOf<MergeRequestStatus>().toEqualTypeOf<
      'pending' | 'approved' | 'rejected' | 'completed'
    >();
  });

  it('requires source and target player ids', () => {
    expectTypeOf<MergeRequest['sourcePlayerId']>().toEqualTypeOf<string>();
    expectTypeOf<MergeRequest['targetPlayerId']>().toEqualTypeOf<string>();
  });
});
