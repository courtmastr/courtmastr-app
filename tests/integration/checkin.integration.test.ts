import { describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { Match, Registration } from '@/types';
import {
  useFrontDeskCheckInWorkflow,
  type BatchRunResult,
} from '@/features/checkin/composables/useFrontDeskCheckInWorkflow';

describe('check-in integration workflow', () => {
  it('returns partial bulk success and supports undoing successful subset', async () => {
    const registrations = ref<Registration[]>([
      {
        id: 'reg-1',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p1',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T09:00:00.000Z'),
      },
      {
        id: 'reg-2',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p2',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T09:00:00.000Z'),
      },
    ]);
    const matches = ref<Match[]>([]);

    const checkInRegistration = vi.fn(async (registrationId: string): Promise<void> => {
      if (registrationId === 'reg-2') {
        throw new Error('registration locked by another station');
      }
      const registration = registrations.value.find((item) => item.id === registrationId);
      if (registration) registration.status = 'checked_in';
    });
    const undoCheckInRegistration = vi.fn(async (registrationId: string): Promise<void> => {
      const registration = registrations.value.find((item) => item.id === registrationId);
      if (registration) registration.status = 'approved';
    });
    const assignBibNumber = vi.fn(async (registrationId: string, bibNumber: number): Promise<void> => {
      const registration = registrations.value.find((item) => item.id === registrationId);
      if (registration) registration.bibNumber = bibNumber;
    });

    let workflow: ReturnType<typeof useFrontDeskCheckInWorkflow> | null = null;
    const Harness = defineComponent({
      setup() {
        workflow = useFrontDeskCheckInWorkflow({
          registrations,
          matches,
          getParticipantName: (registrationId) => `Participant ${registrationId}`,
          getCategoryName: () => 'Category 1',
          checkInRegistration,
          undoCheckInRegistration,
          assignBibNumber,
        });
        return () => null;
      },
    });

    const wrapper = mount(Harness);
    // workflow is assigned inside setup() which TypeScript cannot track via control flow;
    // use non-null assertion since mount() calls setup() synchronously
    const wf = workflow!;
    expect(wf).not.toBeNull();

    const bulkResult = await wf.bulkCheckIn(['reg-1', 'reg-2'], 101);
    expect(bulkResult.successIds).toEqual(['reg-1']);
    expect(bulkResult.failed).toEqual([
      {
        id: 'reg-2',
        reason: 'registration locked by another station',
      },
    ]);
    expect(wf.bulkUndoToken.value?.registrationIds).toEqual(['reg-1']);

    const undoResult: BatchRunResult = await wf.undoBulk();
    expect(undoResult.successIds).toEqual(['reg-1']);
    expect(undoResult.failed).toEqual([]);
    expect(undoCheckInRegistration).toHaveBeenCalledWith('reg-1');

    wrapper.unmount();
  });
});
