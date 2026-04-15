/**
 * Formats a Date as "YYYY-MM-DD" in America/Chicago timezone.
 * Matches the backend `formatDateKey` in functions/src/dailyCheckIn.ts.
 */
export function formatCheckInDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(date);
}
