"use strict";
/**
 * Pure check-in computation — no Firebase imports, unit-testable directly.
 * Shared between applyVolunteerCheckInAction and submitSelfCheckIn.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCheckIn = computeCheckIn;
/**
 * Derives the next check-in state after marking the given participants as present.
 *
 * @param participantIds       - IDs being checked in right now (one for player-by-player, or all for whole-team)
 * @param requiredParticipantIds - all participant IDs that must be present for the registration to be checked_in
 * @param currentPresence      - existing participantPresence map from Firestore
 * @param hasCheckedInAt       - whether checkedInAt is already set on the registration
 */
function computeCheckIn(params) {
    const { participantIds, requiredParticipantIds, currentPresence, hasCheckedInAt } = params;
    const nextPresence = { ...currentPresence };
    for (const id of participantIds) {
        nextPresence[id] = true;
    }
    const allPresent = requiredParticipantIds.length > 0 &&
        requiredParticipantIds.every((id) => nextPresence[id] === true);
    return {
        nextPresence,
        allPresent,
        nextStatus: allPresent ? 'checked_in' : 'approved',
        setCheckedInAt: allPresent && !hasCheckedInAt,
    };
}
//# sourceMappingURL=checkInHelpers.js.map