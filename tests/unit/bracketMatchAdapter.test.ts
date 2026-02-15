import { describe, expect, it } from 'vitest';
import {
  adaptBracketsMatchToLegacyMatch,
  buildMatchStructureMaps,
  type BracketsMatch,
  type Participant,
} from '@/stores/bracketMatchAdapter';

const participants: Participant[] = [
  { id: '1', name: 'reg-a', tournament_id: 'cat-1' },
  { id: '2', name: 'reg-b', tournament_id: 'cat-1' },
];

describe('buildMatchStructureMaps', () => {
  it('maps round_id to round number and bracket type', () => {
    const maps = buildMatchStructureMaps(
      [
        { id: 0, number: 1, group_id: 0 },
        { id: 1, number: 2, group_id: 0 },
        { id: 10, number: 1, group_id: 1 },
        { id: 11, number: 1, group_id: 2 },
      ],
      [
        { id: 0, number: 1 },
        { id: 1, number: 2 },
        { id: 2, number: 3 },
      ]
    );

    expect(maps.roundNumberByRoundId.get('1')).toBe(2);
    expect(maps.bracketByRoundId.get('0')).toBe('winners');
    expect(maps.bracketByRoundId.get('10')).toBe('losers');
    expect(maps.bracketByRoundId.get('11')).toBe('finals');
  });
});

describe('adaptBracketsMatchToLegacyMatch', () => {
  it('resolves round from round_id when round field is absent', () => {
    const maps = buildMatchStructureMaps(
      [{ id: 7, number: 3, group_id: 0 }],
      [{ id: 0, number: 1 }]
    );

    const match: BracketsMatch = {
      id: 99,
      stage_id: 0,
      round_id: 7,
      group_id: 0,
      number: 4,
      opponent1: { id: 1 },
      opponent2: { id: 2 },
      status: 2,
    };

    const adapted = adaptBracketsMatchToLegacyMatch(
      match,
      null,
      participants,
      'cat-1',
      'tournament-1',
      maps
    );

    expect(adapted).not.toBeNull();
    expect(adapted?.id).toBe('99');
    expect(adapted?.round).toBe(3);
    expect(adapted?.matchNumber).toBe(4);
    expect(adapted?.bracketPosition.bracket).toBe('winners');
  });

  it('falls back to direct round/bracket fields when structure map is missing', () => {
    const match: BracketsMatch = {
      id: 'm-1',
      stage_id: '0',
      round: 2,
      bracket: 'losers',
      number: 1,
      opponent1: { id: 1 },
      opponent2: { id: 2 },
      status: 2,
    };

    const adapted = adaptBracketsMatchToLegacyMatch(
      match,
      null,
      participants,
      'cat-1',
      'tournament-1'
    );

    expect(adapted?.round).toBe(2);
    expect(adapted?.bracketPosition.bracket).toBe('losers');
  });
});
