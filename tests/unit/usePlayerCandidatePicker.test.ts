import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { usePlayerCandidatePicker } from '@/composables/usePlayerCandidatePicker';
import type { CandidateMatch } from '@/services/playerIdentityService';

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: true,
}));

vi.mock('@/services/playerIdentityService', () => ({
  findPlayerCandidates: vi.fn(),
}));

import { findPlayerCandidates } from '@/services/playerIdentityService';

const makeCandidate = (): CandidateMatch => ({
  player: {
    id: 'p1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@test.com',
    emailNormalized: 'alice@test.com',
    phone: '555-1234',
    skillLevel: 6,
    userId: null,
    isActive: true,
    isVerified: false,
    identityStatus: 'active',
    mergedIntoPlayerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: { overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 } },
  },
  matchScore: 40,
  matchedSignals: ['name+email'],
});

describe('usePlayerCandidatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty candidates and no selection', () => {
    const { candidates, selectedCandidate, isLoading, error } = usePlayerCandidatePicker();

    expect(candidates.value).toEqual([]);
    expect(selectedCandidate.value).toBeNull();
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('populates candidates on search', async () => {
    vi.mocked(findPlayerCandidates).mockResolvedValue([makeCandidate()]);

    const { candidates, search } = usePlayerCandidatePicker();
    await search({ firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' });

    expect(findPlayerCandidates).toHaveBeenCalledWith({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@test.com',
      phone: null,
      userId: null,
    });
    expect(candidates.value).toHaveLength(1);
    expect(candidates.value[0]?.player.id).toBe('p1');
  });

  it('selectExisting sets selectedCandidate', () => {
    const { selectedCandidate, selectExisting } = usePlayerCandidatePicker();

    selectExisting('p1');
    expect(selectedCandidate.value).toBe('p1');
  });

  it('selectCreateNew clears selectedCandidate', () => {
    const { selectedCandidate, selectExisting, selectCreateNew } = usePlayerCandidatePicker();

    selectExisting('p1');
    selectCreateNew();
    expect(selectedCandidate.value).toBeNull();
  });

  it('reset clears candidates, selection, and error state', async () => {
    vi.mocked(findPlayerCandidates).mockResolvedValue([makeCandidate()]);
    const picker = usePlayerCandidatePicker();

    await picker.search({ firstName: 'Alice', lastName: 'Smith' });
    picker.selectExisting('p1');
    await nextTick();
    picker.reset();

    expect(picker.candidates.value).toEqual([]);
    expect(picker.selectedCandidate.value).toBeNull();
    expect(picker.error.value).toBeNull();
    expect(picker.isLoading.value).toBe(false);
  });

  it('fails soft when candidate lookup throws', async () => {
    vi.mocked(findPlayerCandidates).mockRejectedValue(new Error('boom'));
    const picker = usePlayerCandidatePicker();

    await expect(
      picker.search({ firstName: 'Alice', lastName: 'Smith' }),
    ).resolves.toBeUndefined();

    expect(picker.candidates.value).toEqual([]);
    expect(picker.error.value).toBe('Could not load player suggestions');
    expect(picker.isLoading.value).toBe(false);
  });
});
