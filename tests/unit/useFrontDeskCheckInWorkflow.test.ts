import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { Match, Registration } from '@/types';
import {
  assignSmallestAvailableBib,
  createUndoState,
  computeFrontDeskStats,
  findRegistrationByTypedQuery,
  makeBatchRunner,
  parseScanInput,
  useFrontDeskCheckInWorkflow,
} from '@/features/checkin/composables/useFrontDeskCheckInWorkflow';

interface WorkflowHarnessOptions {
  registrations: Ref<Registration[]>;
  matches: Ref<Match[]>;
  getParticipantName: (registrationId: string) => string;
  getCategoryName: (categoryId: string) => string;
  checkInRegistration: (registrationId: string) => Promise<void>;
  undoCheckInRegistration: (registrationId: string) => Promise<void>;
  assignBibNumber: (registrationId: string, bibNumber: number) => Promise<void>;
}

const mountWorkflowHarness = (options: WorkflowHarnessOptions) => {
  let workflow: ReturnType<typeof useFrontDeskCheckInWorkflow> | null = null;

  const Harness = defineComponent({
    setup() {
      workflow = useFrontDeskCheckInWorkflow({
        registrations: options.registrations,
        matches: options.matches,
        getParticipantName: options.getParticipantName,
        getCategoryName: options.getCategoryName,
        checkInRegistration: options.checkInRegistration,
        undoCheckInRegistration: options.undoCheckInRegistration,
        assignBibNumber: options.assignBibNumber,
      });
      return () => null;
    },
  });

  const wrapper = mount(Harness);
  // workflow is assigned inside setup() so TypeScript can't track it via control flow;
  // use non-null assertion since mount() calls setup() synchronously
  return { wrapper, workflow: workflow! };
};

describe('parseScanInput', () => {
  it('parses explicit registration token payload', () => {
    expect(parseScanInput('reg:abc123')).toEqual({ kind: 'registration', value: 'abc123' });
  });

  it('parses bib payload', () => {
    expect(parseScanInput('102')).toEqual({ kind: 'bib', value: 102 });
  });

  it('rejects empty input', () => {
    expect(parseScanInput('   ')).toBeNull();
  });
});

describe('assignSmallestAvailableBib', () => {
  it('assigns the smallest available bib from start', () => {
    expect(assignSmallestAvailableBib([101, 103, 104], 101)).toBe(102);
  });

  it('returns start when no bibs are used', () => {
    expect(assignSmallestAvailableBib([], 200)).toBe(200);
  });
});

describe('computeFrontDeskStats', () => {
  it('uses approved_total semantics for rate', () => {
    expect(computeFrontDeskStats({ approved: 5, checkedIn: 10, noShow: 2 })).toEqual({
      approvedTotal: 17,
      checkedIn: 10,
      noShow: 2,
      ratePercent: 59,
    });
  });

  it('handles zero denominator', () => {
    expect(computeFrontDeskStats({ approved: 0, checkedIn: 0, noShow: 0 })).toEqual({
      approvedTotal: 0,
      checkedIn: 0,
      noShow: 0,
      ratePercent: 0,
    });
  });
});

describe('makeBatchRunner', () => {
  it('returns partial success summary when one mutation fails', async () => {
    const runBatch = makeBatchRunner(async (id: string) => {
      if (id === 'r2') {
        throw new Error('network');
      }
    });

    await expect(runBatch(['r1', 'r2', 'r3'])).resolves.toEqual({
      successIds: ['r1', 'r3'],
      failed: [{ id: 'r2', reason: 'network' }],
    });
  });
});

describe('createUndoState', () => {
  it('creates item and bulk undo tokens with expected windows', () => {
    const undo = createUndoState();
    const itemToken = undo.startItemUndo('r1', 5000);
    const bulkToken = undo.startBulkUndo(['r1', 'r2'], 10000);

    expect(itemToken.registrationId).toBe('r1');
    expect(itemToken.expiresInMs).toBe(5000);
    expect(bulkToken.registrationIds).toEqual(['r1', 'r2']);
    expect(bulkToken.expiresInMs).toBe(10000);
  });
});

describe('useFrontDeskCheckInWorkflow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires item undo after 5s', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:00.000Z'));

    const registrations = ref<Registration[]>([
      {
        id: 'reg-1',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p1',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
    ]);
    const matches = ref<Match[]>([]);

    const checkInRegistration = vi.fn(async (registrationId: string): Promise<void> => {
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

    const { wrapper, workflow } = mountWorkflowHarness({
      registrations,
      matches,
      getParticipantName: () => 'Aanya Karthik',
      getCategoryName: () => "Women's Singles",
      checkInRegistration,
      undoCheckInRegistration,
      assignBibNumber,
    });

    await workflow.checkInOne('reg-1', 101);
    vi.advanceTimersByTime(5100);

    await expect(workflow.undoItem('reg-1')).rejects.toThrow(/Undo window expired/i);
    expect(undoCheckInRegistration).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('includes disabled reason for urgent participants that cannot check in', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:00.000Z'));

    const registrations = ref<Registration[]>([
      {
        id: 'reg-approved',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p1',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
      {
        id: 'reg-checked-in',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p2',
        status: 'checked_in',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
    ]);

    const matches = ref<Match[]>([
      {
        id: 'm1',
        tournamentId: 't1',
        categoryId: 'cat-1',
        round: 1,
        matchNumber: 1,
        bracketPosition: { bracket: 'winners', round: 1, position: 1 },
        participant1Id: 'reg-approved',
        participant2Id: 'reg-checked-in',
        status: 'scheduled',
        plannedStartAt: new Date('2026-02-27T12:15:00.000Z'),
        scores: [],
        createdAt: new Date('2026-02-27T10:00:00.000Z'),
        updatedAt: new Date('2026-02-27T10:00:00.000Z'),
      },
    ]);

    const { wrapper, workflow } = mountWorkflowHarness({
      registrations,
      matches,
      getParticipantName: (id) => id,
      getCategoryName: () => 'Category',
      checkInRegistration: vi.fn(async () => {}),
      undoCheckInRegistration: vi.fn(async () => {}),
      assignBibNumber: vi.fn(async () => {}),
    });

    const urgentItems = workflow.urgentItems.value;
    const approved = urgentItems.find((item) => item.id === 'reg-approved');
    const checkedIn = urgentItems.find((item) => item.id === 'reg-checked-in');

    expect(approved?.canCheckIn).toBe(true);
    expect(approved?.disabledReason).toBeUndefined();
    expect(checkedIn?.canCheckIn).toBe(false);
    expect(checkedIn?.disabledReason).toBe('Already checked in');

    wrapper.unmount();
  });

  it('tracks throughput metrics for recent check-ins', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-02-27T12:00:00.000Z');
    vi.setSystemTime(startTime);

    const registrations = ref<Registration[]>([
      {
        id: 'reg-1',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p1',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
      {
        id: 'reg-2',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p2',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
    ]);

    const { wrapper, workflow } = mountWorkflowHarness({
      registrations,
      matches: ref<Match[]>([]),
      getParticipantName: (id) => id,
      getCategoryName: () => 'Category',
      checkInRegistration: vi.fn(async (registrationId: string) => {
        const registration = registrations.value.find((item) => item.id === registrationId);
        if (registration) registration.status = 'checked_in';
      }),
      undoCheckInRegistration: vi.fn(async (registrationId: string) => {
        const registration = registrations.value.find((item) => item.id === registrationId);
        if (registration) registration.status = 'approved';
      }),
      assignBibNumber: vi.fn(async (registrationId: string, bibNumber: number) => {
        const registration = registrations.value.find((item) => item.id === registrationId);
        if (registration) registration.bibNumber = bibNumber;
      }),
    });

    await workflow.checkInOne('reg-1', 101);
    vi.setSystemTime(new Date(startTime.getTime() + 90_000));
    vi.advanceTimersByTime(1000);
    await workflow.checkInOne('reg-2', 101);

    expect(workflow.throughput.value.checkInsLastFiveMinutes).toBe(2);
    expect(workflow.throughput.value.avgSecondsPerCheckIn).toBeGreaterThanOrEqual(90);
    expect(workflow.throughput.value.avgSecondsPerCheckIn).toBeLessThanOrEqual(91);

    vi.setSystemTime(new Date(startTime.getTime() + 7 * 60_000));
    vi.advanceTimersByTime(1000);
    expect(workflow.throughput.value.checkInsLastFiveMinutes).toBe(0);

    wrapper.unmount();
  });

  it('undoes the most recent check-in via undoLatest', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:00.000Z'));

    const registrations = ref<Registration[]>([
      {
        id: 'reg-1',
        tournamentId: 't1',
        categoryId: 'cat-1',
        participantType: 'player',
        playerId: 'p1',
        status: 'approved',
        registeredBy: 'admin-1',
        registeredAt: new Date('2026-02-27T10:00:00.000Z'),
      },
    ]);

    const undoCheckInRegistration = vi.fn(async (registrationId: string): Promise<void> => {
      const registration = registrations.value.find((item) => item.id === registrationId);
      if (registration) registration.status = 'approved';
    });

    const { wrapper, workflow } = mountWorkflowHarness({
      registrations,
      matches: ref<Match[]>([]),
      getParticipantName: () => 'Aanya Karthik',
      getCategoryName: () => "Women's Singles",
      checkInRegistration: vi.fn(async (registrationId: string): Promise<void> => {
        const registration = registrations.value.find((item) => item.id === registrationId);
        if (registration) registration.status = 'checked_in';
      }),
      undoCheckInRegistration,
      assignBibNumber: vi.fn(async (registrationId: string, bibNumber: number): Promise<void> => {
        const registration = registrations.value.find((item) => item.id === registrationId);
        if (registration) registration.bibNumber = bibNumber;
      }),
    });

    await workflow.checkInOne('reg-1', 101);
    await workflow.undoLatest();

    expect(undoCheckInRegistration).toHaveBeenCalledWith('reg-1');
    await expect(workflow.undoLatest()).rejects.toThrow(/No recent check-in available to undo/i);
    wrapper.unmount();
  });
});

describe('findRegistrationByTypedQuery', () => {
  const registrations = [
    { id: 'reg-1', status: 'approved' },
    { id: 'reg-2', status: 'approved' },
    { id: 'reg-3', status: 'checked_in' },
  ] as const;

  const getParticipantName = (id: string): string => {
    switch (id) {
      case 'reg-1':
        return 'Aanya Karthik';
      case 'reg-2':
        return 'Adhirai Maheshkumar';
      case 'reg-3':
        return 'Tejas Mayavanshi';
      default:
        return 'Unknown';
    }
  };

  it('matches a participant by unique full name', () => {
    expect(findRegistrationByTypedQuery('aanya karthik', registrations, getParticipantName)).toEqual({
      type: 'match',
      registrationId: 'reg-1',
    });
  });

  it('matches a participant by unique partial name', () => {
    expect(findRegistrationByTypedQuery('tejas', registrations, getParticipantName)).toEqual({
      type: 'match',
      registrationId: 'reg-3',
    });
  });

  it('returns ambiguous when multiple names match', () => {
    expect(findRegistrationByTypedQuery('a', registrations, getParticipantName)).toEqual({
      type: 'ambiguous',
      registrationIds: ['reg-1', 'reg-2', 'reg-3'],
    });
  });

  it('returns not_found when no name match exists', () => {
    expect(findRegistrationByTypedQuery('unknown person', registrations, getParticipantName)).toEqual({
      type: 'not_found',
    });
  });
});
