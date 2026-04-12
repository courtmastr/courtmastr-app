/**
 * Adapter to convert brackets-manager data to legacy Match format.
 *
 * This adapter supports two match schemas:
 * 1) Enhanced match docs with direct `round` and `bracket` fields
 * 2) Canonical brackets-manager docs with `round_id`/`group_id` + /round + /group collections
 */

import type { Match, MatchStatus } from '@/types';
import type { Registration } from '@/types';
import { logger } from '@/utils/logger';

export interface Participant {
  id: string;
  name: string;
  tournament_id: string;
}

// ============================================
// Brackets-Manager Interfaces
// ============================================

export interface BracketsMatch {
    id: string | number;
    stage_id: string | number;
    round?: number | string;
    bracket?: 'winners' | 'losers' | 'finals';
    group_id?: string | number;
    round_id?: string | number;
    number?: number | string;
    opponent1: { id: string | number | null; registrationId?: string; position?: number; result?: string } | null;
    opponent2: { id: string | number | null; registrationId?: string; position?: number; result?: string } | null;
    status: number;
    child_count?: number;
}

export interface BracketsStage {
    id: string | number;
    tournament_id: string;
    name: string;
    type: 'single_elimination' | 'double_elimination' | 'round_robin';
}

export interface BracketsRound {
    id: string | number;
    number?: number | string;
    group_id?: string | number;
}

export interface BracketsGroup {
    id: string | number;
    number?: number | string;
}

export interface MatchStructureMaps {
    roundNumberByRoundId: Map<string, number>;
    bracketByRoundId: Map<string, 'winners' | 'losers' | 'finals'>;
}

// ============================================
// Adapter Functions
// ============================================

/**
 * Convert brackets-manager match to legacy Match interface
 * 
 * Works with both enhanced and canonical brackets-manager schemas.
 * 
 * @param bracketsMatch - Match from brackets-manager (with enhanced fields)
 * @param registrations - All registrations for participant name lookup (optional)
 * @param categoryId - Category/stage ID
 * @param tournamentId - Tournament ID
 * @returns Adapted Match or null if match should be skipped
 */
export function adaptBracketsMatchToLegacyMatch(
    bracketsMatch: BracketsMatch,
    _registrations: Registration[] | null,
    participants: Participant[] | null,
    categoryId: string,
    tournamentId: string,
    structureMaps?: MatchStructureMaps,
    options?: { includeTBD?: boolean }
): Match | null {
    const hasOpponent1 = bracketsMatch.opponent1?.id != null;
    const hasOpponent2 = bracketsMatch.opponent2?.id != null;

    if (!hasOpponent1 && !hasOpponent2) {
        // Return a placeholder match for TBD matches when explicitly requested
        // (used by the time-first scheduler to assign placeholder time slots)
        if (!options?.includeTBD) return null;
        const roundNumber = resolveRoundNumber(bracketsMatch, structureMaps);
        const bracketType = resolveBracketType(bracketsMatch, structureMaps);
        const matchNumber = toPositiveNumber(bracketsMatch.number) ?? 1;
        const groupId = bracketsMatch.group_id != null ? String(bracketsMatch.group_id) : undefined;
        return {
            id: String(bracketsMatch.id),
            tournamentId,
            categoryId,
            stageId: bracketsMatch.stage_id != null ? String(bracketsMatch.stage_id) : undefined,
            round: roundNumber,
            matchNumber,
            bracketPosition: { bracket: bracketType, round: roundNumber, position: matchNumber },
            participant1Id: undefined,
            participant2Id: undefined,
            status: 'ready',
            scores: [],
            groupId,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as Match;
    }

    const roundNumber = resolveRoundNumber(bracketsMatch, structureMaps);
    const bracketType = resolveBracketType(bracketsMatch, structureMaps);
    const matchNumber = toPositiveNumber(bracketsMatch.number) ?? 1;
    const status = convertBracketsStatus(bracketsMatch.status);

    // Only log first few matches to avoid console spam
    if (Math.random() < 0.1) {  // Log ~10% of matches
        logger.debug('[adaptBracketsMatch] Converting match:', bracketsMatch.id,
            '| brackets status:', bracketsMatch.status,
            '→ legacy status:', status,
            '| round:', roundNumber,
            '| category:', categoryId);
    }

    // Use loose equality (==) to handle type coercion between number and string IDs
    const participant1 = participants?.find(p =>
      p.id == bracketsMatch.opponent1?.id
    );
    const participant2 = participants?.find(p =>
      p.id == bracketsMatch.opponent2?.id
    );

    // Debug logging for missing participants
    if (!participant1 && bracketsMatch.opponent1?.id) {
      logger.warn(`[adaptBracketsMatch] Participant1 not found for match ${bracketsMatch.id}:`, {
        opponent1Id: bracketsMatch.opponent1?.id,
        availableParticipants: participants?.map(p => p.id),
        categoryId
      });
    }
    if (!participant2 && bracketsMatch.opponent2?.id) {
      logger.warn(`[adaptBracketsMatch] Participant2 not found for match ${bracketsMatch.id}:`, {
        opponent2Id: bracketsMatch.opponent2?.id,
        availableParticipants: participants?.map(p => p.id),
        categoryId
      });
    }

    // participant.name contains the registration ID (Firestore document ID)
    // participant.id is just the numeric brackets-manager ID
    const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
    const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;

    // Extract winner from opponent.result for both completed and in-progress matches
    let winnerId: string | undefined;
    if (bracketsMatch.opponent1?.result === 'win') {
        winnerId = participant1Id;
    } else if (bracketsMatch.opponent2?.result === 'win') {
        winnerId = participant2Id;
    }

    const groupId = bracketsMatch.group_id != null ? String(bracketsMatch.group_id) : undefined;

    return {
        id: String(bracketsMatch.id),
        tournamentId,
        categoryId,
        stageId: bracketsMatch.stage_id != null ? String(bracketsMatch.stage_id) : undefined,
        round: roundNumber,
        matchNumber,
        bracketPosition: {
            bracket: bracketType,
            round: roundNumber,
            position: matchNumber,
        },
        participant1Id,
        participant2Id,
        winnerId,
        status,
        scores: [],
        groupId,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Match;
}

function toMapKey(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
}

function toPositiveNumber(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return Math.floor(parsed);
}

function resolveRoundNumber(bracketsMatch: BracketsMatch, structureMaps?: MatchStructureMaps): number {
    const roundIdKey = toMapKey(bracketsMatch.round_id);
    if (roundIdKey && structureMaps?.roundNumberByRoundId.has(roundIdKey)) {
        return structureMaps.roundNumberByRoundId.get(roundIdKey) as number;
    }

    return toPositiveNumber(bracketsMatch.round) ?? 1;
}

function resolveBracketType(
    bracketsMatch: BracketsMatch,
    structureMaps?: MatchStructureMaps
): 'winners' | 'losers' | 'finals' {
    const roundIdKey = toMapKey(bracketsMatch.round_id);
    if (roundIdKey && structureMaps?.bracketByRoundId.has(roundIdKey)) {
        return structureMaps.bracketByRoundId.get(roundIdKey) as 'winners' | 'losers' | 'finals';
    }
    return bracketsMatch.bracket || 'winners';
}

function mapGroupNumberToBracket(groupNumber: number): 'winners' | 'losers' | 'finals' {
    switch (groupNumber) {
        case 2:
            return 'losers';
        case 3:
            return 'finals';
        case 1:
        default:
            return 'winners';
    }
}

export function buildMatchStructureMaps(
    rounds: BracketsRound[],
    groups: BracketsGroup[]
): MatchStructureMaps {
    const groupNumberByGroupId = new Map<string, number>();
    for (const group of groups) {
        const groupId = toMapKey(group.id);
        const groupNumber = toPositiveNumber(group.number);
        if (groupId && groupNumber !== null) {
            groupNumberByGroupId.set(groupId, groupNumber);
        }
    }

    const roundNumberByRoundId = new Map<string, number>();
    const bracketByRoundId = new Map<string, 'winners' | 'losers' | 'finals'>();

    for (const round of rounds) {
        const roundId = toMapKey(round.id);
        const roundNumber = toPositiveNumber(round.number);
        const groupId = toMapKey(round.group_id);
        if (!roundId) continue;

        if (roundNumber !== null) {
            roundNumberByRoundId.set(roundId, roundNumber);
        }

        if (groupId) {
            const groupNumber = groupNumberByGroupId.get(groupId);
            if (groupNumber) {
                bracketByRoundId.set(roundId, mapGroupNumberToBracket(groupNumber));
            }
        }
    }

    return {
        roundNumberByRoundId,
        bracketByRoundId,
    };
}

// Converts brackets-manager numeric status to string status
// Only used for initial conversion when match_scores doesn't exist yet
// Once a match has operational data, match_scores.status takes precedence
//
// Brackets-Manager Status Codes:
// - 0 (Locked) = Match structure exists but participants not assigned yet (TBD)
// - 1 (Waiting) = Waiting for previous round to complete
// - 2 (Ready) = Both participants assigned and ready to schedule
// - 3 (Running) = Match in progress
// - 4 (Completed) = Match finished
//
// IMPORTANT: Brackets-manager doesn't track court assignments!
// - All statuses 0, 1, 2 mean "not yet assigned to a court" → map to 'ready'
// - Court assignment is tracked separately in match_scores collection
// - When a match is assigned to a court, match_scores.status = 'scheduled' (overrides this)
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
    switch (bracketsStatus) {
        case 0:
        case 1:
        case 2:
            return 'ready';          // All unscheduled matches that need court assignment
        case 3:
            return 'in_progress';    // Currently playing
        case 4:
            return 'completed';      // Finished
        default:
            return 'ready';
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
    tournamentId: string,
    structureMaps?: MatchStructureMaps,
    options?: { includeTBD?: boolean }
): Match[] {
    return bracketsMatches
        .map(bm => adaptBracketsMatchToLegacyMatch(bm, registrations, participants, categoryId, tournamentId, structureMaps, options))
        .filter((m): m is Match => m !== null);
}
