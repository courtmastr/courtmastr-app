import { describe, expect, it } from 'vitest';
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Match, Participant, Round, Stage } from 'brackets-model';

import { prepareViewerData } from '@/features/brackets/utils/prepareViewerData';

interface GeneratedData {
  stages: Stage[];
  rounds: Round[];
  matches: Match[];
  participants: Participant[];
}

const generateSingleEliminationData = async (participantCount: number): Promise<GeneratedData> => {
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);

  const participants = Array.from({ length: participantCount }, (_, index) => ({
    id: index + 1,
    tournament_id: 'test-category',
    name: `reg-${index + 1}`,
  }));

  await storage.insert('participant', participants);

  const seedingIds: Array<number | null> = participants.map((participant) => participant.id);
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(participantCount, 2)));
  while (seedingIds.length < bracketSize) {
    seedingIds.push(null);
  }

  await manager.create.stage({
    tournamentId: 'test-category',
    name: 'Test Bracket',
    type: 'single_elimination',
    seedingIds,
    settings: {
      seedOrdering: ['inner_outer'],
    },
  });

  const stages = (await storage.select('stage')) as Stage[];
  const stageId = stages[0].id;
  const rounds = (await storage.select('round', { stage_id: stageId })) as Round[];
  const matches = (await storage.select('match', { stage_id: stageId })) as Match[];

  return {
    stages,
    rounds,
    matches,
    participants: participants as Participant[],
  };
};

const getRoundSequence = (matches: Match[]): number[] => {
  const seen = new Set<string>();
  const sequence: number[] = [];

  for (const match of matches) {
    const roundId = String(match.round_id);
    if (seen.has(roundId)) {
      continue;
    }

    seen.add(roundId);
    sequence.push(Number(match.round_id));
  }

  return sequence;
};

describe('prepareViewerData', () => {
  it('sorts single-elimination matches by actual round number before rendering', async () => {
    const generated = await generateSingleEliminationData(10);
    const shuffledMatches = [
      generated.matches[0],
      generated.matches[8],
      generated.matches[14],
      generated.matches[12],
      generated.matches[1],
      generated.matches[9],
      generated.matches[13],
      generated.matches[2],
      generated.matches[10],
      generated.matches[3],
      generated.matches[11],
      generated.matches[4],
      generated.matches[5],
      generated.matches[6],
      generated.matches[7],
    ];

    const prepared = prepareViewerData({
      ...generated,
      matches: shuffledMatches,
      matchGames: [],
    });

    const expectedRoundOrder = generated.rounds
      .slice()
      .sort((left, right) => left.number - right.number)
      .map((round) => Number(round.id));

    expect(getRoundSequence(prepared.matches)).toEqual(expectedRoundOrder);
    expect(prepared.matches.slice(0, 8).every((match) => {
      const round = generated.rounds.find((candidate) => candidate.id === match.round_id);
      return round?.number === 1;
    })).toBe(true);
  });

  it('preserves all matches and their numbers while reordering', async () => {
    const generated = await generateSingleEliminationData(9);
    const prepared = prepareViewerData({
      ...generated,
      matches: generated.matches.slice().reverse(),
      matchGames: [],
    });

    expect(prepared.matches).toHaveLength(generated.matches.length);
    expect(prepared.matches.map((match) => String(match.id)).sort()).toEqual(
      generated.matches.map((match) => String(match.id)).sort()
    );
    expect(prepared.matches.filter((match) => {
      const round = generated.rounds.find((candidate) => candidate.id === match.round_id);
      return round?.number === 1;
    }).map((match) => match.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
