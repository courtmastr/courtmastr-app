/**
 * Adapter to convert brackets-manager data to legacy Match format
 * 
 * This adapter enables the existing Match Store, scoring system, and UI
 * to work with brackets-manager as the single source of truth.
 */

import type { Match, MatchStatus, BracketPosition } from '@/types';

// ============================================
// Brackets-Manager Interfaces
// ============================================

export interface BracketsMatch {
    id: string;
    stage_id: string;
    group_id: string;
    round_id: string;
    number: number;
    opponent1: { id: string | number | null; position?: number; result?: string } | null;
    opponent2: { id: string | number | null; position?: number; result?: string } | null;
    status: number; // 0=locked, 1=waiting, 2=ready, 3=running, 4=completed
    child_count?: number;
}

export interface BracketsParticipant {
    id: string | number;
    tournament_id: string;
    name: string; // This is the registration ID in our system
}

export interface BracketsRound {
    id: string;
    stage_id: string;
    group_id: string;
    number: number;
}

export interface BracketsGroup {
    id: string;
    stage_id: string;
    number: number; // 1=winners, 2=losers, 3=finals (for double elimination)
}

export interface BracketsStage {
    id: string;
    tournament_id: string;
    name: string;
    type: 'single_elimination' | 'double_elimination' | 'round_robin';
}

// ============================================
// Adapter Functions
// ============================================

/**
 * Convert brackets-manager match to legacy Match interface
 * 
 * @param bracketsMatch - Match from brackets-manager
 * @param rounds - All rounds for this tournament
 * @param groups - All groups for this tournament
 * @param participants - All participants (name = registration ID)
 * @param categoryId - Category/stage ID
 * @param tournamentId - Tournament ID
 * @returns Adapted Match or null if match should be skipped
 */
export function adaptBracketsMatchToLegacyMatch(
    bracketsMatch: BracketsMatch,
    rounds: BracketsRound[],
    groups: BracketsGroup[],
    participants: BracketsParticipant[],
    categoryId: string,
    tournamentId: string
): Match | null {
    // Skip matches with no participants yet (future matches in bracket)
    // These are "TBD vs TBD" matches that shouldn't appear in the matches list
    const hasOpponent1 = bracketsMatch.opponent1?.id != null;
    const hasOpponent2 = bracketsMatch.opponent2?.id != null;

    if (!hasOpponent1 && !hasOpponent2) {
        return null; // Skip completely empty matches
    }

    // Get round information
    const round = rounds.find(r => r.id === bracketsMatch.round_id);
    const roundNumber = round?.number || 1;

    // Get bracket type from group
    const group = groups.find(g => g.id === bracketsMatch.group_id);
    const bracketType = getBracketType(group?.number);

    // Convert brackets-manager status to our status
    const status = convertBracketsStatus(bracketsMatch.status);

    // Get registration IDs from participant IDs
    const participant1Id = getRegistrationId(bracketsMatch.opponent1?.id, participants);
    const participant2Id = getRegistrationId(bracketsMatch.opponent2?.id, participants);

    // Determine winner if match is completed
    let winnerId: string | undefined;
    if (bracketsMatch.status === 4) { // completed
        if (bracketsMatch.opponent1?.result === 'win') {
            winnerId = participant1Id;
        } else if (bracketsMatch.opponent2?.result === 'win') {
            winnerId = participant2Id;
        }
    }

    return {
        id: bracketsMatch.id,
        tournamentId,
        categoryId,
        round: roundNumber,
        matchNumber: bracketsMatch.number,
        bracketPosition: {
            bracket: bracketType,
            round: roundNumber,
            position: bracketsMatch.number,
        },
        participant1Id,
        participant2Id,
        winnerId,
        status,
        scores: [], // Scores will be loaded from separate collection
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/**
 * Convert brackets-manager status number to our MatchStatus
 */
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
    switch (bracketsStatus) {
        case 0: // locked - match dependencies not met
            return 'scheduled';
        case 1: // waiting - waiting for participants
            return 'scheduled';
        case 2: // ready - both participants known, ready to play
            return 'ready';
        case 3: // running - currently being played
            return 'in_progress';
        case 4: // completed - match finished
            return 'completed';
        default:
            return 'scheduled';
    }
}

/**
 * Get bracket type string from group number
 */
function getBracketType(groupNumber: number | undefined): BracketPosition['bracket'] {
    switch (groupNumber) {
        case 1:
            return 'winners';
        case 2:
            return 'losers';
        case 3:
            return 'finals';
        default:
            return 'winners';
    }
}

/**
 * Get registration ID from participant ID
 * 
 * Note: IDs may be stored as numbers in brackets-manager but come back as strings from Firestore.
 * We use loose equality (==) to handle this type mismatch.
 */
function getRegistrationId(
    participantId: string | number | null | undefined,
    participants: BracketsParticipant[]
): string | undefined {
    if (!participantId) return undefined;

    // Use loose equality (==) to handle number/string type mismatch
    // Firestore returns IDs as strings, but brackets-manager uses numbers
    const participant = participants.find(p => p.id == participantId);
    return participant?.name; // name stores the registration ID
}

/**
 * Batch convert multiple brackets-manager matches
 */
export function adaptBracketsMatches(
    bracketsMatches: BracketsMatch[],
    rounds: BracketsRound[],
    groups: BracketsGroup[],
    participants: BracketsParticipant[],
    categoryId: string,
    tournamentId: string
): Match[] {
    return bracketsMatches
        .map(bm => adaptBracketsMatchToLegacyMatch(bm, rounds, groups, participants, categoryId, tournamentId))
        .filter((m): m is Match => m !== null); // Remove null entries
}
