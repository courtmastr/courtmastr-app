import type { Match, MatchStatus } from '@/types';

export type MatchSlot = 'participant1' | 'participant2';
export type SlotState = 'resolved' | 'tbd' | 'bye';

interface UseMatchSlotState {
  getSlotState: (match: Match, slot: MatchSlot) => SlotState;
  getSlotLabel: (
    match: Match,
    slot: MatchSlot,
    resolveParticipantName: (registrationId: string | undefined) => string
  ) => string;
  isByeMatch: (match: Match) => boolean;
  isTbdMatch: (match: Match) => boolean;
  isSchedulableMatch: (match: Match) => boolean;
}

const TERMINAL_STATUSES = new Set<MatchStatus>(['completed', 'walkover', 'cancelled']);

const getSlotParticipantId = (match: Match, slot: MatchSlot): string | undefined => {
  return slot === 'participant1' ? match.participant1Id : match.participant2Id;
};

const getOtherSlotParticipantId = (match: Match, slot: MatchSlot): string | undefined => {
  return slot === 'participant1' ? match.participant2Id : match.participant1Id;
};

const isFinalizedByeContext = (match: Match): boolean => {
  return Boolean(match.winnerId) || match.status === 'completed' || match.status === 'walkover';
};

export const useMatchSlotState = (): UseMatchSlotState => {
  const getSlotState = (match: Match, slot: MatchSlot): SlotState => {
    const participantId = getSlotParticipantId(match, slot);
    if (participantId) {
      return 'resolved';
    }

    const otherParticipantId = getOtherSlotParticipantId(match, slot);
    if (!otherParticipantId) {
      return 'tbd';
    }

    return isFinalizedByeContext(match) ? 'bye' : 'tbd';
  };

  const isByeMatch = (match: Match): boolean => {
    return getSlotState(match, 'participant1') === 'bye' || getSlotState(match, 'participant2') === 'bye';
  };

  const isTbdMatch = (match: Match): boolean => {
    return !isByeMatch(match) && (
      getSlotState(match, 'participant1') === 'tbd' || getSlotState(match, 'participant2') === 'tbd'
    );
  };

  const isSchedulableMatch = (match: Match): boolean => {
    if (TERMINAL_STATUSES.has(match.status)) {
      return false;
    }

    return !isByeMatch(match);
  };

  const getSlotLabel = (
    match: Match,
    slot: MatchSlot,
    resolveParticipantName: (registrationId: string | undefined) => string
  ): string => {
    const slotState = getSlotState(match, slot);

    if (slotState === 'bye') {
      return 'BYE';
    }

    if (slotState === 'tbd') {
      return 'TBD';
    }

    return resolveParticipantName(getSlotParticipantId(match, slot));
  };

  return {
    getSlotState,
    getSlotLabel,
    isByeMatch,
    isTbdMatch,
    isSchedulableMatch,
  };
};
