import { differenceInMinutes } from 'date-fns';
import { type Match } from '@/types';

export function useMatchDuration() {
    function getMatchDuration(match: Match): { text: string; minutes: number; isLong: boolean } {
        if (!match.startedAt) {
            return { text: 'Just started', minutes: 0, isLong: false };
        }

        const startedAt = match.startedAt instanceof Date ? match.startedAt : new Date(match.startedAt);
        const minutes = differenceInMinutes(new Date(), startedAt);

        if (minutes < 1) {
            return { text: 'Just started', minutes: 0, isLong: false };
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        let text = '';
        if (hours > 0) {
            text = `${hours}h ${mins}m`;
        } else {
            text = `${mins}m`;
        }

        const isLong = minutes > 45;

        return { text, minutes, isLong };
    }

    function getDurationColor(match: Match): string {
        const { minutes } = getMatchDuration(match);
        if (minutes > 60) return 'error'; // Red for overtime (> 60m)
        if (minutes > 45) return 'warning'; // Yellow for long (> 45m)
        return 'success'; // Green for normal
    }

    return {
        getMatchDuration,
        getDurationColor
    };
}
