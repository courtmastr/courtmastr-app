import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock stores
vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: vi.fn(),
}));
vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: vi.fn(),
}));

import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useCheckInHistory } from '@/features/checkin/composables/useCheckInHistory';

const mockRegistrations = [
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
      },
    },
  },
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
  {
    id: 'reg-partial',
    categoryId: 'cat-2',
    playerId: 'player-4',
    partnerPlayerId: 'player-5',
    teamName: undefined,
    dailyCheckIns: {
      '2026-04-14': {
        source: 'kiosk' as const,
        presence: { 'player-4': true, 'player-5': false },
      },
    },
  },
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

  it('builds rows only for the selected date', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z'); // noon Chicago (UTC-5)
    await history.refresh();
    const ids = history.rows.value.map(r => r.registrationId);
    expect(ids).not.toContain('reg-other-day');
  });

  it('resolves singles display name from player store', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const row = history.rows.value.find(r => r.registrationId === 'reg-singles');
    expect(row).toBeDefined();
    expect(row!.displayName).toBe('Marcus Johnson');
    expect(row!.source).toBe('kiosk');
    expect(row!.isPartial).toBe(false);
  });

  it('uses teamName for doubles displayName when available', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const row = history.rows.value.find(r => r.registrationId === 'reg-doubles-full');
    expect(row!.displayName).toBe('Johnson / Smith');
    expect(row!.isPartial).toBe(false);
    expect(row!.source).toBe('admin');
  });

  it('marks partial doubles row correctly', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const row = history.rows.value.find(r => r.registrationId === 'reg-partial');
    expect(row).toBeDefined();
    expect(row!.isPartial).toBe(true);
    expect(row!.source).toBe('partial');
    expect(row!.checkedInAt).toBeNull();
    expect(row!.displayName).toBe('David Kim');
  });

  it('sorts fully checked-in rows descending, partial at bottom', async () => {
    const history = useCheckInHistory();
    history.selectedDate.value = new Date('2026-04-14T17:00:00Z');
    await history.refresh();
    const rows = history.rows.value;
    const fullRows = rows.filter(r => !r.isPartial);
    const partialRows = rows.filter(r => r.isPartial);
    if (partialRows.length > 0 && fullRows.length > 0) {
      // All partial rows come after all full rows
      const firstPartialIdx = rows.findIndex(r => r.isPartial);
      const lastFullIdx = rows.reduce(
        (acc, r, i) => (!r.isPartial ? i : acc),
        -1
      );
      expect(lastFullIdx).toBeLessThan(firstPartialIdx);
    }
    for (let i = 1; i < fullRows.length; i++) {
      expect(fullRows[i - 1].checkedInAt!.getTime()).toBeGreaterThanOrEqual(
        fullRows[i].checkedInAt!.getTime()
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
