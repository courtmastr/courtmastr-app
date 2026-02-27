import { describe, expect, it } from 'vitest';
import type { Category, Match } from '@/types';
import {
  generateMatchDisplayId,
  useMatchIdentification,
} from '@/composables/useMatchIdentification';

const baseDate = new Date('2026-01-01T10:00:00.000Z');

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  status: 'scheduled',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tournamentId: 't-1',
  name: "Women's Singles",
  type: 'singles',
  gender: 'women',
  ageGroup: 'open',
  format: 'single_elimination',
  seedingEnabled: true,
  status: 'setup',
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

describe('generateMatchDisplayId', () => {
  it('uses WS prefix for women categories without men-substring collision', () => {
    const match = makeMatch();
    const category = makeCategory({ name: "Women's Singles" });

    const display = generateMatchDisplayId(match, category, 1);

    expect(display.displayId).toMatch(/^WS-/);
    expect(display.shortId).toBe('WS-001');
  });
});

describe('useMatchIdentification', () => {
  it('formats match number with women alias', () => {
    const { formatMatchNumber } = useMatchIdentification();
    const match = makeMatch({ categoryId: 'cat-ws', matchNumber: 7 });
    const categories: Category[] = [makeCategory({ id: 'cat-ws', name: "Women's Singles" })];

    expect(formatMatchNumber(match, categories)).toBe('WS #7');
  });
});
