import type { Match, MatchGame, Participant, Round, Stage } from 'brackets-model';

export interface ViewerData {
  stages: Stage[];
  matches: Match[];
  matchGames: MatchGame[];
  participants: Participant[];
  rounds?: Round[];
}

const toNumericOrder = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

export const prepareViewerData = (data: ViewerData): Omit<ViewerData, 'rounds'> => {
  // LOCKED CONTRACT: This function protects the brackets-manager ->
  // brackets-viewer handoff. Do not remove or bypass this sort unless the
  // viewer library changes and 9/10-player regression cases are revalidated.
  if (!data.rounds || data.rounds.length === 0) {
    return {
      stages: data.stages,
      matches: data.matches,
      matchGames: data.matchGames,
      participants: data.participants,
    };
  }

  const roundOrderById = new Map<string, number>(
    data.rounds.map((round) => [String(round.id), toNumericOrder(round.number)])
  );

  const sortedMatches = data.matches.slice().sort((left, right) => {
    const leftRoundOrder = roundOrderById.get(String(left.round_id ?? '')) ?? Number.MAX_SAFE_INTEGER;
    const rightRoundOrder = roundOrderById.get(String(right.round_id ?? '')) ?? Number.MAX_SAFE_INTEGER;
    if (leftRoundOrder !== rightRoundOrder) {
      return leftRoundOrder - rightRoundOrder;
    }

    const leftNumber = toNumericOrder(left.number);
    const rightNumber = toNumericOrder(right.number);
    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return String(left.id).localeCompare(String(right.id));
  });

  return {
    stages: data.stages,
    matches: sortedMatches,
    matchGames: data.matchGames,
    participants: data.participants,
  };
};
