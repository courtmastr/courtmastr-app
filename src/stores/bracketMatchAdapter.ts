/**
 * Adapter to convert brackets-manager data to legacy Match format
 * 
 * This adapter enables the existing Match Store, scoring system, and UI
 * to work with brackets-manager as the single source of truth.
 * 
 * OPTIMIZED VERSION: Works with minimal 3-collection schema (stage, match, registrations)
 * - round and bracket fields are derived from match document directly
 * - opponent IDs are registration IDs directly (no participant lookup needed)
 */

import type { Match, MatchStatus, BracketPosition } from '@/types';
import type { Registration } from '@/types';

// ============================================
// Brackets-Manager Interfaces
// ============================================

export interface BracketsMatch {
    id: string;
    stage_id: string;
    round?: number;
    bracket?: 'winners' | 'losers' | 'finals';
    group_id?: string;
    round_id?: string;
    number: number;
    opponent1: { id: string | number | null; registrationId?: string; position?: number; result?: string } | null;
    opponent2: { id: string | number | null; registrationId?: string; position?: number; result?: string } | null;
    status: number;
    child_count?: number;
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
 * OPTIMIZED: Works with minimal 3-collection schema
 * - round is read directly from match.round (not from rounds collection)
 * - bracket is read directly from match.bracket (not from groups collection)
 * - opponent IDs are registration IDs directly (not participant IDs)
 * 
 * @param bracketsMatch - Match from brackets-manager (with enhanced fields)
 * @param registrations - All registrations for participant name lookup (optional)
 * @param categoryId - Category/stage ID
 * @param tournamentId - Tournament ID
 * @returns Adapted Match or null if match should be skipped
 */
export function adaptBracketsMatchToLegacyMatch(
    bracketsMatch: BracketsMatch,
    registrations: Registration[] | null,
    categoryId: string,
    tournamentId: string
): Match | null {
    const hasOpponent1 = bracketsMatch.opponent1?.id != null;
    const hasOpponent2 = bracketsMatch.opponent2?.id != null;

    if (!hasOpponent1 && !hasOpponent2) {
        return null;
    }

    const roundNumber = bracketsMatch.round || 1;
    const bracketType = bracketsMatch.bracket || 'winners';
    const status = convertBracketsStatus(bracketsMatch.status);

    // Use registrationId if available, otherwise fall back to sequential id
    const participant1Id = bracketsMatch.opponent1?.registrationId || bracketsMatch.opponent1?.id?.toString() || undefined;
    const participant2Id = bracketsMatch.opponent2?.registrationId || bracketsMatch.opponent2?.id?.toString() || undefined;

    let winnerId: string | undefined;
    if (bracketsMatch.status === 4) {
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
        scores: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function convertBracketsStatus(bracketsStatus: number): MatchStatus {
    switch (bracketsStatus) {
        case 0:
        case 1:
            return 'scheduled';
        case 2:
            return 'ready';
        case 3:
            return 'in_progress';
        case 4:
            return 'completed';
        default:
            return 'scheduled';
    }
}

/**
 * Batch convert multiple brackets-manager matches
 * 
 * OPTIMIZED: Works with minimal 3-collection schema
 */
export function adaptBracketsMatches(
    bracketsMatches: BracketsMatch[],
    registrations: Registration[] | null,
    categoryId: string,
    tournamentId: string
): Match[] {
    return bracketsMatches
        .map(bm => adaptBracketsMatchToLegacyMatch(bm, registrations, categoryId, tournamentId))
        .filter((m): m is Match => m !== null);
}
