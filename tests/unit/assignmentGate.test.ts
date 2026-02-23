import { describe, expect, it } from 'vitest';
import { evaluateAssignmentBlockers, type AssignmentGateInput } from '@/stores/matches';

function makeInput(overrides: Partial<AssignmentGateInput> = {}): AssignmentGateInput {
  return {
    plannedStartAt: new Date('2026-02-23T10:00:00.000Z'),
    scheduleStatus: 'published',
    publishedAt: new Date('2026-02-23T09:00:00.000Z'),
    participant1Id: 'reg-1',
    participant2Id: 'reg-2',
    participantsCheckedIn: true,
    ...overrides,
  };
}

describe('evaluateAssignmentBlockers', () => {
  it('blocks when match is not scheduled', () => {
    const blockers = evaluateAssignmentBlockers(
      makeInput({ plannedStartAt: undefined })
    );
    expect(blockers).toContain('Blocked: Not scheduled');
  });

  it('blocks when schedule is not published', () => {
    const blockers = evaluateAssignmentBlockers(
      makeInput({ scheduleStatus: 'draft', publishedAt: undefined })
    );
    expect(blockers).toContain('Blocked: Not published');
  });

  it('blocks when participants are missing', () => {
    const blockers = evaluateAssignmentBlockers(
      makeInput({ participant2Id: undefined })
    );
    expect(blockers).toContain('Blocked: Players not checked-in');
  });

  it('blocks when players are not checked-in', () => {
    const blockers = evaluateAssignmentBlockers(
      makeInput({ participantsCheckedIn: false })
    );
    expect(blockers).toContain('Blocked: Players not checked-in');
  });

  it('allows admin check-in override when other gates pass', () => {
    const blockers = evaluateAssignmentBlockers(
      makeInput({ participantsCheckedIn: false }),
      { ignoreCheckInGate: true }
    );
    expect(blockers).toEqual([]);
  });

  it('returns no blockers when all gates pass', () => {
    const blockers = evaluateAssignmentBlockers(makeInput());
    expect(blockers).toEqual([]);
  });
});
