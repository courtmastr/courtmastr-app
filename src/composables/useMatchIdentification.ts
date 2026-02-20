import type { Match, Category } from '@/types';

export interface MatchDisplayId {
  id: string;
  displayId: string;
  shortId: string;
}

/**
 * Generates unambiguous match identifiers
 * Format: {CATEGORY_CODE}-{BRACKET_TYPE}{ROUND}-###
 * Example: MS-WB1-001 (Men's Singles - Winner's Bracket Round 1 - Match 001)
 */
export function generateMatchDisplayId(
  match: Match,
  category: Category,
  tournamentMatchNumber: number
): MatchDisplayId {
  // Generate category code from category name
  const categoryCode = generateCategoryCode(category.name);
  
  // Generate bracket type and round
  const bracketInfo = getBracketInfo(match.round);
  
  // Format: XX-BR### (e.g., MS-WB1-001)
  const displayId = `${categoryCode}-${bracketInfo}${String(tournamentMatchNumber).padStart(3, '0')}`;
  
  // Short ID for compact displays
  const shortId = `${categoryCode}-${String(tournamentMatchNumber).padStart(3, '0')}`;
  
  return {
    id: match.id,
    displayId,
    shortId
  };
}

function generateCategoryCode(categoryName: string): string {
  // Extract initials from category name
  // Men's Singles -> MS
  // Women's Doubles -> WD
  // Mixed Doubles -> XD
  
  const words = categoryName.split(/\s+/);
  let code = '';
  
  for (const word of words) {
    if (word.toLowerCase().includes('men')) code += 'M';
    else if (word.toLowerCase().includes('women')) code += 'W';
    else if (word.toLowerCase().includes('mixed')) code += 'X';
    else if (word.toLowerCase().includes('single')) code += 'S';
    else if (word.toLowerCase().includes('double')) code += 'D';
  }
  
  return code || categoryName.substring(0, 2).toUpperCase();
}

function getBracketInfo(round: number): string {
  // Map round numbers to bracket notation
  // Round 1-3: Winner's bracket rounds WB1, WB2, WB3
  // Round 4+: Could be finals, semifinals, etc.
  
  if (round <= 3) {
    return `WB${round}-`;
  } else if (round === 4) {
    return 'SF-'; // Semi-finals
  } else if (round === 5) {
    return 'F-'; // Finals
  }
  
  return `R${round}-`;
}

/**
 * Composable for match identification
 */
export function useMatchIdentification() {
  /**
   * Generate a simple sequential ID for matches within a tournament
   */
  const generateSequentialId = (index: number): string => {
    return `M-${String(index + 1).padStart(3, '0')}`;
  };
  
  /**
   * Format match number for display
   */
  const formatMatchNumber = (match: Match, categories: Category[]): string => {
    const category = categories.find(c => c.id === match.categoryId);
    if (!category) return `#${match.matchNumber}`;
    
    const catCode = generateCategoryCode(category.name);
    return `${catCode} #${match.matchNumber}`;
  };
  
  return {
    generateMatchDisplayId,
    generateSequentialId,
    formatMatchNumber
  };
}
