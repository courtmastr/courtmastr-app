import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Match } from '@/types';

export function useMatchDisplay() {
  const { getParticipantName } = useParticipantResolver();

  function getMatchDisplayName(match: Match): string {
    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    return `${p1} vs ${p2}`;
  }

  function getMatchWithContext(match: Match): string {
    return `Round ${match.round} - Match #${match.matchNumber}: ${getMatchDisplayName(match)}`;
  }

  function getMatchWithBracket(match: Match): string {
    const bracket = match.bracketPosition?.bracket 
      ? match.bracketPosition.bracket.charAt(0).toUpperCase() + match.bracketPosition.bracket.slice(1)
      : 'Winners';
      
    return `${bracket} Bracket - Round ${match.round}: ${getMatchDisplayName(match)}`;
  }

  function getBracketCode(match: Match): string {
    if (match.isLosersBracket) return 'L';
    if (match.bracketPosition?.bracket === 'finals') return 'F';
    return 'W';
  }

  function getMatchStatusColor(status: Match | string): string {
    const s = typeof status === 'string' ? status : status.status;
    switch (s) {
      case 'in_progress':
        return 'success';
      case 'completed':
        return 'grey';
      case 'ready':
        return 'warning';
      case 'scheduled':
        return 'info';
      case 'walkover':
        return 'error';
      case 'cancelled':
        return 'grey-lighten-2';
      default:
        return 'grey';
    }
  }

  function getMatchStatusLabel(status: Match | string): string {
    const s = typeof status === 'string' ? status : status.status;
    switch (s) {
      case 'in_progress':
        return 'Live';
      case 'completed':
        return 'Done';
      case 'ready':
        return 'Ready';
      case 'scheduled':
        return 'Scheduled';
      case 'walkover':
        return 'Walkover';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s;
    }
  }

  function formatMatchDuration(minutes: number | undefined | null): string {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  function getRankBadgeColor(rank: number): string {
    if (rank === 1) return 'warning';
    if (rank === 2) return 'grey-lighten-1';
    if (rank === 3) return 'brown';
    return 'grey';
  }

  return {
    getMatchDisplayName,
    getMatchWithContext,
    getMatchWithBracket,
    getBracketCode,
    getMatchStatusColor,
    getMatchStatusLabel,
    formatMatchDuration,
    getRankBadgeColor
  };
}
