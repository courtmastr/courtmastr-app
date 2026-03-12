export const normalizeCheckInQuery = (value: string): string => value.trim().toLowerCase();

const getStartsWithWordBoundary = (text: string, query: string): boolean => {
  if (!query) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.some((word) => word.startsWith(query));
};

const getMatchScore = (text: string, query: string): number | null => {
  if (!query) return null;
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (getStartsWithWordBoundary(text, query)) return 2;
  if (text.includes(query)) return 3;
  return null;
};

interface RankedItem<T> {
  item: T;
  score: number;
  normalizedText: string;
  index: number;
}

export interface RankItemsByQueryOptions<T> {
  items: readonly T[];
  query: string;
  getSearchText: (item: T) => string;
  limit?: number;
}

export const rankItemsByQuery = <T>({
  items,
  query,
  getSearchText,
  limit,
}: RankItemsByQueryOptions<T>): T[] => {
  const normalizedQuery = normalizeCheckInQuery(query);
  if (!normalizedQuery) return [];

  const ranked: RankedItem<T>[] = [];

  items.forEach((item, index) => {
    const normalizedText = normalizeCheckInQuery(getSearchText(item));
    const score = getMatchScore(normalizedText, normalizedQuery);
    if (score === null) return;

    ranked.push({
      item,
      score,
      normalizedText,
      index,
    });
  });

  ranked.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const textOrder = a.normalizedText.localeCompare(b.normalizedText);
    if (textOrder !== 0) return textOrder;
    return a.index - b.index;
  });

  const sliced = typeof limit === 'number' ? ranked.slice(0, Math.max(0, limit)) : ranked;
  return sliced.map((entry) => entry.item);
};
