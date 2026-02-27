import type { Category, Match } from '@/types';

export interface ScheduleTarget {
  categoryId: string;
  levelId?: string;
}

export function resolveScheduleTargetsForCategory(
  category: Category,
  matches: Match[]
): ScheduleTarget[] {
  const categoryMatches = matches.filter((match) => match.categoryId === category.id);
  const levelIds = [...new Set(
    categoryMatches
      .map((match) => match.levelId)
      .filter((levelId): levelId is string => Boolean(levelId))
  )].sort();

  const shouldUseLevelScopes =
    category.format === 'pool_to_elimination'
    && category.levelingStatus === 'generated'
    && levelIds.length > 0;

  if (shouldUseLevelScopes) {
    return levelIds.map((levelId) => ({
      categoryId: category.id,
      levelId,
    }));
  }

  return [{ categoryId: category.id }];
}
