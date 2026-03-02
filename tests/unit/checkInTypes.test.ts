import { describe, expect, it } from 'vitest';
import {
  isCheckInSearchableStatus,
  toCheckInStatus,
} from '@/features/checkin/composables/checkInTypes';

describe('checkInTypes', () => {
  it('accepts only searchable statuses', () => {
    expect(isCheckInSearchableStatus('approved')).toBe(true);
    expect(isCheckInSearchableStatus('checked_in')).toBe(true);
    expect(isCheckInSearchableStatus('no_show')).toBe(true);
    expect(isCheckInSearchableStatus('pending')).toBe(false);
  });

  it('normalizes invalid statuses to null', () => {
    expect(toCheckInStatus('approved')).toBe('approved');
    expect(toCheckInStatus('rejected')).toBeNull();
  });
});
