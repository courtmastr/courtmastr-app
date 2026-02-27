import type { Match } from '@/types';

const FALLBACK_LEVEL_SCOPE = 'base';

export const buildGlobalMatchKey = (match: Pick<Match, 'tournamentId' | 'categoryId' | 'levelId' | 'id'>): string =>
  `${match.tournamentId}:${match.categoryId}:${match.levelId ?? FALLBACK_LEVEL_SCOPE}:${match.id}`;

export const getCategoryAlias = (categoryName: string): string => {
  const normalized = categoryName.trim().toLowerCase();

  const hasWord = (word: string): boolean =>
    new RegExp(`\\b${word}\\b`, 'i').test(normalized);

  const isMixed = hasWord('mixed');
  const isWomen = /\bwomen(?:'s)?\b/i.test(normalized);
  const isMen = /\bmen(?:'s)?\b/i.test(normalized);
  const isSingles = hasWord('single') || hasWord('singles');
  const isDoubles = hasWord('double') || hasWord('doubles');

  if (isMixed && isDoubles) return 'MXD';
  if (isMixed && isSingles) return 'MXS';
  if (isMen && isSingles) return 'MS';
  if (isMen && isDoubles) return 'MD';
  if (isWomen && isSingles) return 'WS';
  if (isWomen && isDoubles) return 'WD';

  const fallback = categoryName
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .replace(/[^A-Z0-9]/g, '');

  return fallback.slice(0, 3) || 'CAT';
};

export const buildDisplayCodeMap = (
  matches: Match[],
  getCategoryName: (id: string) => string
): Map<string, string> => {
  const groupedByCategory = new Map<string, Match[]>();

  for (const match of matches) {
    const existing = groupedByCategory.get(match.categoryId) ?? [];
    groupedByCategory.set(match.categoryId, [...existing, match]);
  }

  const displayCodeMap = new Map<string, string>();

  for (const [categoryId, categoryMatches] of groupedByCategory.entries()) {
    const alias = getCategoryAlias(getCategoryName(categoryId));
    const sorted = [...categoryMatches].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;

      const aLevel = a.levelId ?? '';
      const bLevel = b.levelId ?? '';
      if (aLevel !== bLevel) return aLevel.localeCompare(bLevel);

      return a.id.localeCompare(b.id);
    });

    sorted.forEach((match, index) => {
      displayCodeMap.set(buildGlobalMatchKey(match), `${alias}${index + 1}`);
    });
  }

  return displayCodeMap;
};
