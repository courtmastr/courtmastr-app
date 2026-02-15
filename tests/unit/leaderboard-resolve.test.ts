/**
 * Leaderboard resolveMatches integration unit tests
 *
 * Exercises the full Firestore join path with realistic mock documents.
 * No Firebase needed — all pure function calls.
 *
 * Document shapes match the actual Firestore schema documented in
 * docs/TOURNAMENT_LEADERBOARD_PLAN.md §2.
 */

import { describe, it, expect } from 'vitest';
import { resolveMatches } from '@/composables/useLeaderboard';
import type { ResolvedMatch } from '@/types/leaderboard';

// ---------------------------------------------------------------------------
// Helpers — build realistic Firestore-shaped mock docs
// ---------------------------------------------------------------------------

/** /participant doc: id = brackets-manager sequential int, name = registrationId */
function makeParticipant(id: number, registrationId: string) {
  return { id, name: registrationId };
}

/** /match doc with optional enhancment registrationId field */
function makeMatchDoc(
  id: string,
  opponent1Id: number | null,
  opponent2Id: number | null,
  opts: { round?: number; bracket?: 'winners' | 'losers' | 'finals'; reg1?: string; reg2?: string } = {}
) {
  return {
    id,
    opponent1: opponent1Id !== null
      ? { id: opponent1Id, ...(opts.reg1 ? { registrationId: opts.reg1 } : {}) }
      : null,
    opponent2: opponent2Id !== null
      ? { id: opponent2Id, ...(opts.reg2 ? { registrationId: opts.reg2 } : {}) }
      : null,
    round: opts.round ?? 1,
    bracket: opts.bracket,
  };
}

/** /match_scores doc */
function makeScoreDoc(
  id: string,
  winnerId: string,
  status: 'completed' | 'walkover' = 'completed',
  scores: Array<{ gameNumber: number; score1: number; score2: number; winnerId?: string; isComplete: boolean }> = []
) {
  return { id, winnerId, status, scores };
}

// ---------------------------------------------------------------------------
// Shared fixtures: 4-player round robin
//   participants: p0=reg-alice, p1=reg-bob, p2=reg-charlie, p3=reg-dan
// ---------------------------------------------------------------------------

const participants = [
  makeParticipant(0, 'reg-alice'),
  makeParticipant(1, 'reg-bob'),
  makeParticipant(2, 'reg-charlie'),
  makeParticipant(3, 'reg-dan'),
];

const CAT = 'cat1';

// ---------------------------------------------------------------------------

describe('resolveMatches — participant ID resolution via participant.name', () => {
  it('resolves opponent IDs through participantMap (no registrationId enhancement)', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1, { round: 1 })];
    const scoreDocs = [makeScoreDoc('m1', 'reg-alice', 'completed', [
      { gameNumber: 1, score1: 21, score2: 15, winnerId: 'reg-alice', isComplete: true },
      { gameNumber: 2, score1: 21, score2: 18, winnerId: 'reg-alice', isComplete: true },
    ])];

    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);

    expect(result).toHaveLength(1);
    expect(result[0].participant1Id).toBe('reg-alice');
    expect(result[0].participant2Id).toBe('reg-bob');
    expect(result[0].winnerId).toBe('reg-alice');
  });

  it('prefers registrationId enhancement field over participantMap lookup', () => {
    // Match doc has explicit registrationId — should be used directly
    const matchDocs = [makeMatchDoc('m1', 99, 100, {
      reg1: 'reg-alice-direct',
      reg2: 'reg-bob-direct',
    })];
    const scoreDocs = [makeScoreDoc('m1', 'reg-alice-direct')];

    // participantMap won't have entries for IDs 99/100 (not in our participants array)
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);

    expect(result).toHaveLength(1);
    expect(result[0].participant1Id).toBe('reg-alice-direct');
    expect(result[0].participant2Id).toBe('reg-bob-direct');
  });

  it('skips matches where participant IDs cannot be resolved', () => {
    // opponent IDs 10, 11 are not in participantMap
    const matchDocs = [makeMatchDoc('m1', 10, 11, { round: 1 })];
    const scoreDocs = [makeScoreDoc('m1', 'reg-unknown')];

    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    expect(result).toHaveLength(0);
  });

  it('skips matches where opponent1 is null (bye slot)', () => {
    const matchDocs = [makeMatchDoc('m1', null, 1, { round: 1 })];
    const scoreDocs = [makeScoreDoc('m1', 'reg-bob')];

    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    expect(result).toHaveLength(0);
  });

  it('skips matches where opponent2 is null (bye slot)', () => {
    const matchDocs = [makeMatchDoc('m1', 0, null, { round: 1 })];
    const scoreDocs = [makeScoreDoc('m1', 'reg-alice')];

    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    expect(result).toHaveLength(0);
  });
});

describe('resolveMatches — status filtering', () => {
  it('includes completed matches', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1)];
    const scoreDocs = [makeScoreDoc('m1', 'reg-alice', 'completed')];
    expect(resolveMatches(CAT, participants, matchDocs, scoreDocs)).toHaveLength(1);
  });

  it('includes walkover matches', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1)];
    const scoreDocs = [makeScoreDoc('m1', 'reg-alice', 'walkover')];
    expect(resolveMatches(CAT, participants, matchDocs, scoreDocs)).toHaveLength(1);
  });

  it('excludes matches with no score document', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1)];
    expect(resolveMatches(CAT, participants, matchDocs, [])).toHaveLength(0);
  });

  it('excludes score docs with missing winnerId', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1)];
    const scoreDocs = [{ id: 'm1', status: 'completed', scores: [], winnerId: undefined }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveMatches(CAT, participants, matchDocs, scoreDocs as any)).toHaveLength(0);
  });
});

describe('resolveMatches — score and round propagation', () => {
  it('propagates game scores, round, and completedAt correctly', () => {
    const completedAt = new Date('2026-02-13T14:00:00Z');
    const matchDocs = [makeMatchDoc('m1', 0, 2, { round: 3, bracket: 'winners' })];
    const scoreDocs = [{
      id: 'm1',
      winnerId: 'reg-alice',
      status: 'completed',
      completedAt: { toDate: () => completedAt },
      scores: [
        { gameNumber: 1, score1: 21, score2: 10, winnerId: 'reg-alice', isComplete: true },
        { gameNumber: 2, score1: 18, score2: 21, winnerId: 'reg-charlie', isComplete: true },
        { gameNumber: 3, score1: 21, score2: 19, winnerId: 'reg-alice', isComplete: true },
      ],
    }];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs as any);

    expect(result).toHaveLength(1);
    const m = result[0] as ResolvedMatch;
    expect(m.round).toBe(3);
    expect(m.bracket).toBe('winners');
    expect(m.scores).toHaveLength(3);
    expect(m.completedAt).toEqual(completedAt);
    expect(m.scores[0].score1).toBe(21);
    expect(m.scores[1].winnerId).toBe('reg-charlie');
  });

  it('handles missing completedAt gracefully (undefined)', () => {
    const matchDocs = [makeMatchDoc('m1', 0, 1)];
    const scoreDocs = [{ id: 'm1', winnerId: 'reg-alice', status: 'completed', scores: [] }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs as any);
    expect(result[0].completedAt).toBeUndefined();
  });
});

describe('resolveMatches — full 4-player round robin scenario', () => {
  // 6 matches (each pair plays once)
  // alice(0) vs bob(1), alice(0) vs charlie(2), alice(0) vs dan(3)
  // bob(1) vs charlie(2), bob(1) vs dan(3)
  // charlie(2) vs dan(3)

  const matchDocs = [
    makeMatchDoc('m-a-b', 0, 1, { round: 1 }),
    makeMatchDoc('m-a-c', 0, 2, { round: 1 }),
    makeMatchDoc('m-a-d', 0, 3, { round: 1 }),
    makeMatchDoc('m-b-c', 1, 2, { round: 2 }),
    makeMatchDoc('m-b-d', 1, 3, { round: 2 }),
    makeMatchDoc('m-c-d', 2, 3, { round: 2 }),
  ];

  const scoreDocs = [
    makeScoreDoc('m-a-b', 'reg-alice'),
    makeScoreDoc('m-a-c', 'reg-alice'),
    makeScoreDoc('m-a-d', 'reg-alice'),
    makeScoreDoc('m-b-c', 'reg-bob'),
    makeScoreDoc('m-b-d', 'reg-bob'),
    makeScoreDoc('m-c-d', 'reg-charlie'),
  ];

  it('resolves all 6 matches', () => {
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    expect(result).toHaveLength(6);
  });

  it('all matches have categoryId set', () => {
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    expect(result.every((m) => m.categoryId === CAT)).toBe(true);
  });

  it('resolves correct participant IDs for each match', () => {
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    const ab = result.find((m) => m.id === 'm-a-b')!;
    expect(ab.participant1Id).toBe('reg-alice');
    expect(ab.participant2Id).toBe('reg-bob');
    expect(ab.winnerId).toBe('reg-alice');

    const cd = result.find((m) => m.id === 'm-c-d')!;
    expect(cd.participant1Id).toBe('reg-charlie');
    expect(cd.participant2Id).toBe('reg-dan');
    expect(cd.winnerId).toBe('reg-charlie');
  });

  it('participant.id string coercion works (brackets-manager uses integers)', () => {
    // participantMap keys are built with String(p.id) — verify id=0 isn't falsy-skipped
    const result = resolveMatches(CAT, participants, matchDocs, scoreDocs);
    const aliceMatches = result.filter(
      (m) => m.participant1Id === 'reg-alice' || m.participant2Id === 'reg-alice'
    );
    expect(aliceMatches).toHaveLength(3);
  });
});
