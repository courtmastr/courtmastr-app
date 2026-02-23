export function formatDurationSmart(minutes: number): string {
  if (minutes < 0) minutes = 0;

  const HOUR_MINUTES = 60;
  const DAY_MINUTES = 24 * HOUR_MINUTES;
  const MONTH_MINUTES = 30 * DAY_MINUTES;
  const YEAR_MINUTES = 12 * MONTH_MINUTES;

  if (minutes < HOUR_MINUTES) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < DAY_MINUTES) {
    const hours = Math.floor(minutes / HOUR_MINUTES);
    const mins = Math.round(minutes % HOUR_MINUTES);
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  if (minutes < MONTH_MINUTES) {
    const days = Math.round(minutes / DAY_MINUTES);
    return `${days} day(s)`;
  }

  if (minutes < YEAR_MINUTES) {
    const months = Math.round(minutes / MONTH_MINUTES);
    return `${months} month(s)`;
  }

  const years = Math.round(minutes / YEAR_MINUTES);
  return `${years} year(s)`;
}

export function formatDurationAgo(minutes: number): string {
  if (minutes < 1) return 'just now';
  const duration = formatDurationSmart(minutes);
  return `${duration} ago`;
}

export function useDurationFormatter() {
  return {
    formatDuration: formatDurationSmart,
    formatDurationAgo,
  };
}

export default useDurationFormatter;
