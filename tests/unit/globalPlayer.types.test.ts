import { describe, it, expectTypeOf } from 'vitest';
import type { GlobalPlayer } from '@/types';

describe('GlobalPlayer v2 type', () => {
  it('allows email to be null or undefined', () => {
    expectTypeOf<GlobalPlayer['email']>().toEqualTypeOf<string | null | undefined>();
  });

  it('allows emailNormalized to be null or undefined', () => {
    expectTypeOf<GlobalPlayer['emailNormalized']>().toEqualTypeOf<string | null | undefined>();
  });

  it('requires identityStatus field', () => {
    expectTypeOf<GlobalPlayer['identityStatus']>().toEqualTypeOf<
      'active' | 'merged' | 'pending_merge'
    >();
  });

  it('allows mergedIntoPlayerId', () => {
    expectTypeOf<GlobalPlayer['mergedIntoPlayerId']>().toEqualTypeOf<string | null | undefined>();
  });
});
