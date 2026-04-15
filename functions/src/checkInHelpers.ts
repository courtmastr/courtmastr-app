/**
 * Pure check-in computation — no Firebase imports, unit-testable directly.
 * Shared between applyVolunteerCheckInAction and submitSelfCheckIn.
 */

export interface CheckInResult {
  nextPresence: Record<string, boolean>;
  allPresent: boolean;
  nextStatus: 'checked_in' | 'approved';
  /** true when checkedInAt should be stamped (allPresent and not already set) */
  setCheckedInAt: boolean;
}

/**
 * Derives the next check-in state after marking the given participants as present.
 *
 * @param participantIds       - IDs being checked in right now (one for player-by-player, or all for whole-team)
 * @param requiredParticipantIds - all participant IDs that must be present for the registration to be checked_in
 * @param currentPresence      - existing participantPresence map from Firestore
 * @param hasCheckedInAt       - whether checkedInAt is already set on the registration
 */
export function computeCheckIn(params: {
  participantIds: string[];
  requiredParticipantIds: string[];
  currentPresence: Record<string, boolean>;
  hasCheckedInAt: boolean;
}): CheckInResult {
  const { participantIds, requiredParticipantIds, currentPresence, hasCheckedInAt } = params;

  const nextPresence = { ...currentPresence };
  for (const id of participantIds) {
    nextPresence[id] = true;
  }

  const allPresent =
    requiredParticipantIds.length > 0 &&
    requiredParticipantIds.every((id) => nextPresence[id] === true);

  return {
    nextPresence,
    allPresent,
    nextStatus: allPresent ? 'checked_in' : 'approved',
    setCheckedInAt: allPresent && !hasCheckedInAt,
  };
}
