import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: vi.fn(),
}));
vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: vi.fn(),
}));
vi.mock('@/features/checkin/utils/checkInDateKey', () => ({
  formatCheckInDateKey: (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(date),
}));

import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useCheckInHistory } from '@/features/checkin/composables/useCheckInHistory';

const mockRegistrations = [
  // Singles — checked in via kiosk
  {
    id: 'reg-singles',
    categoryId: 'cat-1',
    playerId: 'player-1',
    partnerPlayerId: undefined,
    teamName: undefined,
    dailyCheckIns: {
      '2026-04-14': {
        checkedInAt: new Date('2026-04-14T14:47:00Z'),
        source: 'kiosk' as const,
        presence: { 'player-1': true },
      },
    },
  },
  // Doubles — both partners checked in via admin
  {
    id: 'reg-doubles-full',
    categoryId: 'cat-2',
    playerId: 'player-2',
    partnerPlayerId: 'player-3',
    teamName: 'Johnson / Smith',
    dailyCheckIns: {
      '2026-04-14': {
        checkedInAt: new Date('2026-04-14T14:31:00Z'),
        source: 'admin' as const,
        presence: { 'player-2': true, 'player-3': true },
      },
    },
  },
  // Doubles — only one partner present (partial)
  {
    id: 'reg-partial',
    categoryId: 'cat-2',
    playerId: 'player-4',
    partnerPlayerId: 'player-5',
    teamName: undefined,
    dailyCheckIns: {
      '2026-04-14': {
        // no checkedInAt = partial
        source: 'kiosk' as const,
        presence: { 'player-4': true, 'player-5': false },
      },
    },
  },
  // Different day — should be excluded
  {
    id: 'reg-other-day',
    categoryId: 'cat-1',
    playerId: 'player-6',
    dailyCheckIns: {
      '2026-04-13': {
        checkedInAt: new Date('2026-04-13T14:00:00Z'),
        source: 'admin' as const,
      },
    },
  },
];

const mockPlayers = [
  { id: 'player-1', firstName: 'Marcus', lastName: 'Johnson' },
  { id: 'player-2', firstName: 'Priya', lastName: 'Sharma' },
  { id: 'player-3', firstName: 'Anita', lastName: 'Rao' },
  { id: 'player-4', firstName: 'David', lastName: 'Kim' },
  { id: 'player-5', firstName: 'Wei', lastName: 'Chen' },
  { id: 'player-6', firstName: 'Sarah', lastName: 'Lee' },
];

const mockCategories = [
  { id: 'cat-1', name: "Men's Singles Open" },
  { id: 'cat-2', name: 'Mixed Doubles A' },
];

describe('useCheckInHistory', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useRegistrationStore).mockReturnValue({
      registrations: mockRegistrations,
      players: mockPlayers,
    } as any);
    vi.mocked(useTournamentStore).mockReturnValue({
      categories: mockCategories,
    } as any);
  });

  it('excludes registrations from other days', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const ids = history.rows.value.map(r => r.registrationId);
    expect(ids).not.toContain('reg-other-day');
  });

  it('returns one row for a singles player', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const singlesRows = history.rows.value.filter(r => r.registrationId === 'reg-singles');
    expect(singlesRows).toHaveLength(1);
    expect(singlesRows[0].playerId).toBe('player-1');
    expect(singlesRows[0].displayName).toBe('Marcus Johnson');
    expect(singlesRows[0].source).toBe('kiosk');
    expect(singlesRows[0].isPartial).toBe(false);
  });

  it('returns two rows for a fully checked-in doubles registration', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const doublesRows = history.rows.value.filter(r => r.registrationId === 'reg-doubles-full');
    expect(doublesRows).toHaveLength(2);
    const playerIds = doublesRows.map(r => r.playerId).sort();
    expect(playerIds).toEqual(['player-2', 'player-3']);
    doublesRows.forEach(row => {
      expect(row.isPartial).toBe(false);
      expect(row.source).toBe('admin');
      expect(row.categoryName).toBe('Mixed Doubles A');
    });
  });

  it('shows each player by individual name (not team name) for doubles', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const doublesRows = history.rows.value.filter(r => r.registrationId === 'reg-doubles-full');
    const names = doublesRows.map(r => r.displayName).sort();
    expect(names).toEqual(['Anita Rao', 'Priya Sharma']);
    // Team name "Johnson / Smith" should NOT appear
    expect(doublesRows.every(r => r.displayName !== 'Johnson / Smith')).toBe(true);
  });

  it('returns one row for partial doubles (only the present player)', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const partialRows = history.rows.value.filter(r => r.registrationId === 'reg-partial');
    expect(partialRows).toHaveLength(1);
    expect(partialRows[0].playerId).toBe('player-4');
    expect(partialRows[0].displayName).toBe('David Kim');
    expect(partialRows[0].isPartial).toBe(true);
    expect(partialRows[0].source).toBe('partial');
    expect(partialRows[0].checkedInAt).toBeNull();
  });

  it('sorts fully checked-in rows descending by time, partial rows at bottom', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const rows = history.rows.value;
    const fullRows = rows.filter(r => !r.isPartial);
    const partialRows = rows.filter(r => r.isPartial);

    if (partialRows.length > 0 && fullRows.length > 0) {
      const lastFullIdx = rows.reduce((acc, r, i) => (!r.isPartial ? i : acc), -1);
      const firstPartialIdx = rows.findIndex(r => r.isPartial);
      expect(lastFullIdx).toBeLessThan(firstPartialIdx);
    }
    for (let i = 1; i < fullRows.length; i++) {
      expect(fullRows[i - 1].checkedInAt!.getTime()).toBeGreaterThanOrEqual(
        fullRows[i].checkedInAt!.getTime(),
      );
    }
  });

  it('canGoForward is false when selectedDate is today', () => {
    const history = useCheckInHistory();
    expect(history.canGoForward.value).toBe(false);
  });

  it('canGoForward is true for past dates', () => {
    const history = useCheckInHistory();
    history.goBack();
    expect(history.canGoForward.value).toBe(true);
  });

  it('goBack and goForward navigate by one day', () => {
    const history = useCheckInHistory();
    const today = new Date(history.selectedDate.value);
    history.goBack();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(history.selectedDate.value.toDateString()).toBe(yesterday.toDateString());
    history.goForward();
    expect(history.selectedDate.value.toDateString()).toBe(today.toDateString());
  });

  it('sets loading false after refresh', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    expect(history.loading.value).toBe(false);
  });
});
