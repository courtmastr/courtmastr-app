import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  searchCallableMock,
  submitCallableMock,
  httpsCallableMock,
} = vi.hoisted(() => {
  const searchMock = vi.fn();
  const submitMock = vi.fn();
  const callableMock = vi.fn((_functions, name: string) => {
    if (name === 'searchSelfCheckInCandidates') return searchMock;
    if (name === 'submitSelfCheckIn') return submitMock;
    throw new Error(`Unexpected callable: ${name}`);
  });

  return {
    searchCallableMock: searchMock,
    submitCallableMock: submitMock,
    httpsCallableMock: callableMock,
  };
});

vi.mock('@/services/firebase', () => ({
  functions: {},
  httpsCallable: httpsCallableMock,
}));

import { useSelfCheckIn } from '@/features/checkin/composables/useSelfCheckIn';

describe('useSelfCheckIn', () => {
  beforeEach(() => {
    searchCallableMock.mockReset();
    submitCallableMock.mockReset();
    httpsCallableMock.mockClear();
  });

  it('loads candidates from search callable', async () => {
    searchCallableMock.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            registrationId: 'reg-1',
            categoryId: 'cat-1',
            categoryName: 'Mixed Doubles',
            displayName: 'Aanya / Tejas',
            partnerName: 'Tejas',
            playerId: 'p1',
            partnerPlayerId: 'p2',
            status: 'approved',
          },
        ],
      },
    });

    const vm = useSelfCheckIn('t-1');
    await vm.search('aa');

    expect(searchCallableMock).toHaveBeenCalledWith({ tournamentId: 't-1', query: 'aa' });
    expect(vm.candidates.value).toHaveLength(1);
    expect(vm.candidates.value[0].registrationId).toBe('reg-1');
  });

  it('clears candidates when query has fewer than 2 chars', async () => {
    const vm = useSelfCheckIn('t-1');
    vm.candidates.value = [{
      registrationId: 'reg-1',
      categoryId: 'cat-1',
      categoryName: 'Mixed Doubles',
      displayName: 'Aanya / Tejas',
      partnerName: 'Tejas',
      playerId: 'p1',
      partnerPlayerId: 'p2',
      status: 'approved',
    }];

    await vm.search('a');

    expect(vm.candidates.value).toEqual([]);
    expect(searchCallableMock).not.toHaveBeenCalled();
  });

  it('submits check-in payload and stores result', async () => {
    submitCallableMock.mockResolvedValueOnce({
      data: {
        registrationId: 'reg-1',
        status: 'checked_in',
        waitingForPartner: false,
        requiredParticipantIds: ['p1', 'p2'],
        presentParticipantIds: ['p1', 'p2'],
      },
    });

    const vm = useSelfCheckIn('t-1');
    const result = await vm.submit({
      registrationId: 'reg-1',
      participantIds: ['p1', 'p2'],
    });

    expect(submitCallableMock).toHaveBeenCalledWith({
      tournamentId: 't-1',
      registrationId: 'reg-1',
      participantIds: ['p1', 'p2'],
    });
    expect(result.status).toBe('checked_in');
    expect(vm.lastResult.value?.registrationId).toBe('reg-1');
  });
});
