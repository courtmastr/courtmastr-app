export type SchedulePublicState = 'all' | 'published' | 'draft' | 'not_scheduled';
export type ScheduleLayout = 'compact' | 'full';

export function parseScheduleQueryCategory(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return 'all';
}

export function parseScheduleQueryPublicState(value: unknown): SchedulePublicState {
  if (
    value === 'all'
    || value === 'published'
    || value === 'draft'
    || value === 'not_scheduled'
  ) {
    return value;
  }
  return 'all';
}

export function parseScheduleQueryLayout(value: unknown): ScheduleLayout {
  if (value === 'compact' || value === 'full') {
    return value;
  }
  return 'compact';
}
