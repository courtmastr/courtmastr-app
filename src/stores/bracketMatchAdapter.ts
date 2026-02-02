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

export interface Participant {
  id: string;
  name: string;
  tournament_id: string;
}

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
    participants: Participant[] | null,
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

    // Debug logging for participant resolution
    console.log('🔍 [bracketMatchAdapter] Match:', bracketsMatch.id, {
      opponent1Id: bracketsMatch.opponent1?.id,
      opponent2Id: bracketsMatch.opponent2?.id,
      participantsCount: participants?.length || 0
    });

    // Use loose equality (==) to handle type coercion between number and string IDs
    const participant1 = participants?.find(p =>
      p.id == bracketsMatch.opponent1?.id
    );
    const participant2 = participants?.find(p =>
      p.id == bracketsMatch.opponent2?.id
    );

    console.log('🔍 [bracketMatchAdapter] Found participants:', {
      participant1: participant1 ? { id: participant1.id, name: participant1.name } : null,
      participant2: participant2 ? { id: participant2.id, name: participant2.name } : null
    });

    const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
    const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;

    console.log('🔍 [bracketMatchAdapter] Final IDs:', {
      participant1Id,
      participant2Id
    });

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

// Converts brackets-manager numeric status to string status
// Only used for initial conversion when match_scores doesn't exist yet
// Once a match has operational data, match_scores.status takes precedence
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
    participants: Participant[] | null,
    categoryId: string,
    tournamentId: string
): Match[] {
    return bracketsMatches
        .map(bm => adaptBracketsMatchToLegacyMatch(bm, registrations, participants, categoryId, tournamentId))
        .filter((m): m is Match => m !== null);
}
