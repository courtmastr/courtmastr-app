import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_DEFAULTS,
  SCHEDULE_CONSTRAINTS,
  SCHEDULE_FIELDS,
  SCHEDULE_STATUS,
} from '@/scheduling/scheduleRules';

describe('scheduleRules', () => {
  it('has sensible default values', () => {
    expect(SCHEDULE_DEFAULTS.matchDurationMinutes).toBeGreaterThan(0);
    expect(SCHEDULE_DEFAULTS.bufferMinutes).toBeGreaterThanOrEqual(0);
    expect(SCHEDULE_DEFAULTS.minRestTimeMinutes).toBeGreaterThanOrEqual(0);
    expect(SCHEDULE_DEFAULTS.concurrency).toBeGreaterThan(0);
    expect(SCHEDULE_DEFAULTS.slotIntervalMinutes).toBeGreaterThan(0);
  });

  it('constraints have min <= max', () => {
    for (const [key, range] of Object.entries(SCHEDULE_CONSTRAINTS) as [string, { min: number; max: number }][]) {
      expect(range.min, `${key}: min must be <= max`).toBeLessThanOrEqual(range.max);
    }
  });

  it('field names are non-empty strings', () => {
    for (const [key, value] of Object.entries(SCHEDULE_FIELDS) as [string, string][]) {
      expect(typeof value, `${key} must be a string`).toBe('string');
      expect(value.length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('status values match expected strings', () => {
    expect(SCHEDULE_STATUS.draft).toBe('draft');
    expect(SCHEDULE_STATUS.published).toBe('published');
  });

  it('plannedStartAt is the canonical time field name', () => {
    expect(SCHEDULE_FIELDS.plannedStartAt).toBe('plannedStartAt');
  });
});
