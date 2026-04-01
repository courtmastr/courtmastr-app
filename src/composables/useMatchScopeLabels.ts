import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import type { LevelDefinition, Match } from '@/types';

type LevelDefinitionsByCategory = Record<string, LevelDefinition[]>;

export function toReadableLevelLabel(levelId: string): string {
  return levelId
    .replace(/^level-/i, 'Level ')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildMatchScopeKey(match: Match): string | null {
  if (match.levelId) return `level:${match.categoryId}:${match.levelId}`;
  if (match.groupId) return `pool:${match.categoryId}:${match.groupId}`;
  return null;
}

export function resolveLevelLabel(
  categoryId: string,
  levelId: string | undefined,
  levelDefinitionsByCategory: LevelDefinitionsByCategory,
): string | null {
  if (!levelId) return null;

  const levelDefinition = levelDefinitionsByCategory[categoryId]?.find((level) => level.id === levelId);
  return levelDefinition?.name?.trim() || toReadableLevelLabel(levelId);
}

export function resolveMatchScopeLabel(
  match: Match,
  levelDefinitionsByCategory: LevelDefinitionsByCategory,
): string | null {
  if (match.levelId) {
    return resolveLevelLabel(match.categoryId, match.levelId, levelDefinitionsByCategory);
  }

  if (match.groupId) {
    return `Pool ${match.groupId}`;
  }

  return null;
}

export function useMatchScopeLabels(
  tournamentId: MaybeRefOrGetter<string>,
  matches: MaybeRefOrGetter<Match[]>,
) {
  const tournamentStore = useTournamentStore();
  const levelDefinitionsByCategory = ref<LevelDefinitionsByCategory>({});
  const loadingCategoryIds = new Set<string>();

  async function ensureCategoryLevels(categoryId: string): Promise<void> {
    if (levelDefinitionsByCategory.value[categoryId] || loadingCategoryIds.has(categoryId)) return;

    loadingCategoryIds.add(categoryId);
    try {
      const levels = await tournamentStore.fetchCategoryLevels(toValue(tournamentId), categoryId);
      levelDefinitionsByCategory.value = {
        ...levelDefinitionsByCategory.value,
        [categoryId]: levels,
      };
    } catch (error) {
      console.error('Failed to fetch category levels for match scope labels:', error);
    } finally {
      loadingCategoryIds.delete(categoryId);
    }
  }

  watch(
    () => toValue(matches),
    (currentMatches) => {
      const categoryIdsWithLevels = [...new Set(
        currentMatches
          .filter((match) => Boolean(match.levelId))
          .map((match) => match.categoryId),
      )];

      for (const categoryId of categoryIdsWithLevels) {
        void ensureCategoryLevels(categoryId);
      }
    },
    { immediate: true, deep: true },
  );

  const availableScopes = computed(() => {
    const scopeByKey = new Map<string, string>();

    for (const match of toValue(matches)) {
      const scopeKey = buildMatchScopeKey(match);
      const scopeLabel = resolveMatchScopeLabel(match, levelDefinitionsByCategory.value);
      if (!scopeKey || !scopeLabel) continue;
      scopeByKey.set(scopeKey, scopeLabel);
    }

    return [...scopeByKey.entries()]
      .map(([value, title]) => ({ value, title }))
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { numeric: true }));
  });

  function getLevelLabel(categoryId: string, levelId: string | undefined): string | null {
    return resolveLevelLabel(categoryId, levelId, levelDefinitionsByCategory.value);
  }

  function getMatchScopeLabel(match: Match): string | null {
    return resolveMatchScopeLabel(match, levelDefinitionsByCategory.value);
  }

  return {
    availableScopes,
    levelDefinitionsByCategory,
    getLevelLabel,
    getMatchScopeLabel,
    buildMatchScopeKey,
  };
}
