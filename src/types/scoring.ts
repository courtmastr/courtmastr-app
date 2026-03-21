// Score Correction Types
// Extensions for match score correction functionality

import type { GameScore } from './index';

/**
 * Record of a score correction for audit trail
 */
export interface ScoreCorrectionRecord {
  id: string;
  matchId: string;
  originalScores: GameScore[];
  newScores: GameScore[];
  originalWinnerId?: string;
  newWinnerId?: string;
  reason: string;
  correctionType: 'manual' | 'correction';
  correctedBy: string;
  correctedByName: string;
  correctedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Request to correct a match score
 */
export interface ScoreCorrectionRequest {
  originalScores: GameScore[];
  newScores: GameScore[];
  originalWinnerId?: string;
  newWinnerId?: string;
  reason: string;
  correctionType: 'manual' | 'correction';
}

/**
 * Result of score correction validation
 */
export interface CorrectionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Match with correction metadata
 */
export interface MatchWithCorrections {
  corrected?: boolean;
  correctionCount?: number;
  lastCorrectedAt?: Date;
  lastCorrectedBy?: string;
}

/**
 * Game score in editable form
 */
export interface EditableGameScore extends GameScore {
  isEditing?: boolean;
}
