// Pure functions for daily check-in reset logic.
// No Firebase imports — these are unit-tested directly via Vitest.

export interface MatchForReset {
  participant1Id?: string;
  participant2Id?: string;
  plannedStartAt?: Date | null;
}

/**
 * Returns a YYYY-MM-DD date string for the given date in the given IANA timezone.
 * Uses the 'en-CA' locale which formats as YYYY-MM-DD natively.
 */
export function formatDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}

/**
 * Returns today's YYYY-MM-DD key in the given timezone.
 */
export function getTodayKey(timezone = 'America/Chicago'): string {
  return formatDateKey(new Date(), timezone);
}

/**
 * Returns UTC Date objects for the start and end of the local calendar day
 * that contains `now` in the given timezone.
 *
 * Strategy: compute how many milliseconds into the local day `now` is,
 * then subtract to reach local midnight.
 */
export function getTodayWindowUTC(
  now: Date,
  timezone: string
): { windowStart: Date; windowEnd: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const localHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const localMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const localSecond = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);

  const msIntoLocalDay = (localHour * 3600 + localMinute * 60 + localSecond) * 1000;
  const windowStart = new Date(now.getTime() - msIntoLocalDay);
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

  return { windowStart, windowEnd };
}

/**
 * Given a set of matches and registration statuses, returns the IDs of
 * registrations that should have their check-in status reset.
 *
 * A registration is reset when:
 *  - It has at least one match with plannedStartAt within [windowStart, windowEnd)
 *  - Its current status is 'checked_in' or 'no_show'
 */
export function computeResetTargets(params: {
  matches: MatchForReset[];
  registrationStatuses: Map<string, string>;
  windowStart: Date;
  windowEnd: Date;
}): string[] {
  const { matches, registrationStatuses, windowStart, windowEnd } = params;

  const idsWithMatchesInWindow = new Set<string>();
  for (const match of matches) {
    const t = match.plannedStartAt;
    if (!t) continue;
    if (t >= windowStart && t < windowEnd) {
      if (match.participant1Id) idsWithMatchesInWindow.add(match.participant1Id);
      if (match.participant2Id) idsWithMatchesInWindow.add(match.participant2Id);
    }
  }

  return [...idsWithMatchesInWindow].filter((id) => {
    const status = registrationStatuses.get(id);
    return status === 'checked_in' || status === 'no_show';
  });
}
