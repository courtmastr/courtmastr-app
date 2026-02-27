/**
 * Scheduling Rules — Single Source of Truth
 *
 * All scheduling defaults, constraints, canonical field names, and status
 * values live here. Nothing else in the codebase should hard-code these values.
 */

/** Default values used when the user does not configure a parameter */
export const SCHEDULE_DEFAULTS = {
  matchDurationMinutes: 30,
  bufferMinutes: 5,
  minRestTimeMinutes: 15,
  concurrency: 2,
  slotIntervalMinutes: 15,    // Grid row height in ScheduleGridView
} as const;

/** Hard limits for input validation */
export const SCHEDULE_CONSTRAINTS = {
  matchDuration:  { min: 10, max: 120 },
  buffer:         { min: 0,  max: 30 },
  minRestTime:    { min: 0,  max: 60 },
  concurrency:    { min: 1,  max: 20 },
} as const;

/**
 * Canonical Firestore field names.
 * Use these instead of string literals when referencing schedule fields.
 * `plannedStartAt` is the source of truth; `scheduledTime` is the legacy field.
 */
export const SCHEDULE_FIELDS = {
  plannedStartAt:   'plannedStartAt',
  plannedEndAt:     'plannedEndAt',
  scheduleStatus:   'scheduleStatus',
  scheduleVersion:  'scheduleVersion',
  lockedTime:       'lockedTime',
  courtId:          'courtId',
  publishedAt:      'publishedAt',
  publishedBy:      'publishedBy',
} as const;

/** Canonical schedule status values */
export const SCHEDULE_STATUS = {
  draft:     'draft',
  published: 'published',
} as const;

export type ScheduleStatus = typeof SCHEDULE_STATUS[keyof typeof SCHEDULE_STATUS];

/**
 * Documented algorithmic invariants.
 * These are enforced in useTimeScheduler / useMatchScheduler;
 * the comments here are the authoritative explanation for each rule.
 */
export const SCHEDULE_RULES = {
  /**
   * Matches with lockedTime === true are skipped by the auto-scheduler.
   * Their existing plannedStartAt / plannedEndAt are preserved.
   */
  lockedMatchesArePreserved: true,

  /**
   * Court concurrency is determined by courts with status === 'available'.
   * Courts with status === 'in_use' or 'maintenance' are excluded.
   */
  concurrencyCountsAvailableCourtsOnly: true,

  /**
   * The capacity guard inspects both 'draft' AND 'published' existing windows
   * when checking whether a new schedule would exceed court capacity.
   */
  capacityGuardIncludesDraft: true,
} as const;
