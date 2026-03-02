import type {
  LeaderboardParticipantDoc,
  LeaderboardMatchDoc,
  LeaderboardMatchScoreDoc,
} from '@/types/leaderboard';

type Assert<T extends true> = T;
type HasIdString<T> = T extends { id: string } ? true : false;

type _participantHasName = Assert<LeaderboardParticipantDoc extends { name: string } ? true : false>;
type _matchHasStringId = Assert<HasIdString<LeaderboardMatchDoc>>;
type _scoreHasStringId = Assert<HasIdString<LeaderboardMatchScoreDoc>>;

const participantDoc: LeaderboardParticipantDoc = { id: 1, name: 'reg-1' };
const matchDoc: LeaderboardMatchDoc = {
  id: 'm-1',
  round: 1,
  opponent1: { id: 1 },
  opponent2: { id: 2 },
};
const scoreDoc: LeaderboardMatchScoreDoc = {
  id: 'm-1',
  status: 'completed',
  winnerId: 'reg-1',
  scores: [],
};

void participantDoc;
void matchDoc;
void scoreDoc;
void (0 as unknown as _participantHasName);
void (0 as unknown as _matchHasStringId);
void (0 as unknown as _scoreHasStringId);
