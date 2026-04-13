import { differenceInMinutes } from 'date-fns';
import { type Match } from '@/types';

const STALE_THRESHOLD_MINUTES = 180; // Matches running > 3h are considered stale/abandoned

export function useMatchDuration() {
    function getMatchDuration(match: Match): { text: string; minutes: number; isLong: boolean; isStale: boolean } {
        if (!match.startedAt) {
            return { text: 'Just started', minutes: 0, isLong: false, isStale: false };
        }

        const startedAt = match.startedAt instanceof Date ? match.startedAt : new Date(match.startedAt);
        const minutes = differenceInMinutes(new Date(), startedAt);

        if (minutes < 1) {
            return { text: 'Just started', minutes: 0, isLong: false, isStale: false };
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const isStale = minutes > STALE_THRESHOLD_MINUTES;

        let text = '';
        if (hours > 0) {
            text = isStale ? `${hours}h ${mins}m (stale)` : `${hours}h ${mins}m`;
        } else {
            text = `${mins}m`;
        }

        const isLong = minutes > 45;

        return { text, minutes, isLong, isStale };
    }

    function getDurationColor(match: Match): string {
        const { minutes, isStale } = getMatchDuration(match);
        if (isStale) return 'error';      // Red for stale/abandoned (> 3h)
        if (minutes > 60) return 'error'; // Red for overtime (> 60m)
        if (minutes > 45) return 'warning'; // Yellow for long (> 45m)
        return 'success'; // Green for normal
    }

    return {
        getMatchDuration,
        getDurationColor
    };
}
