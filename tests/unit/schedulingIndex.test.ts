import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_DEFAULTS,
  SCHEDULE_CONSTRAINTS,
  SCHEDULE_FIELDS,
  SCHEDULE_STATUS,
  SCHEDULE_RULES,
  resolveScheduleTargetsForCategory,
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
  useScheduleOrchestrator,
  saveManualPlannedTime,
  publishMatchSchedule,
} from '@/scheduling';

describe('scheduling barrel index', () => {
  it('exports SCHEDULE_DEFAULTS', () => expect(SCHEDULE_DEFAULTS).toBeDefined());
  it('exports SCHEDULE_CONSTRAINTS', () => expect(SCHEDULE_CONSTRAINTS).toBeDefined());
  it('exports SCHEDULE_FIELDS', () => expect(SCHEDULE_FIELDS).toBeDefined());
  it('exports SCHEDULE_STATUS', () => expect(SCHEDULE_STATUS).toBeDefined());
  it('exports SCHEDULE_RULES', () => expect(SCHEDULE_RULES).toBeDefined());
  it('exports resolveScheduleTargetsForCategory', () => expect(resolveScheduleTargetsForCategory).toBeDefined());
  it('exports buildOccupiedWindows', () => expect(buildOccupiedWindows).toBeDefined());
  it('exports extractScheduledWindows', () => expect(extractScheduledWindows).toBeDefined());
  it('exports findCapacityConflict', () => expect(findCapacityConflict).toBeDefined());
  it('exports useScheduleOrchestrator', () => expect(useScheduleOrchestrator).toBeDefined());
  it('exports saveManualPlannedTime', () => expect(saveManualPlannedTime).toBeDefined());
  it('exports publishMatchSchedule', () => expect(publishMatchSchedule).toBeDefined());
});
