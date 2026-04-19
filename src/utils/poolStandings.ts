import type { MatchStatus } from '@/types';

export interface PoolStandingsParticipant {
  registrationId: string;
  participantName: string;
  fallbackOrder?: number;
}

export interface PoolStandingsScore {
  score1: number;
  score2: number;
}

export interface PoolStandingsMatch {
  participant1Id?: string;
  participant2Id?: string;
  winnerId?: string;
  status: MatchStatus | 'completed' | 'walkover';
  scores?: PoolStandingsScore[];
}

export interface PoolStandingsEntry {
  registrationId: string;
  participantName: string;
  fallbackOrder?: number;
  played: number;
  matchesWon: number;
  matchesLost: number;
  matchPoints: number;
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

function createEmptyEntry(participant: PoolStandingsParticipant): PoolStandingsEntry {
  return {
    registrationId: participant.registrationId,
    participantName: participant.participantName,
    fallbackOrder: participant.fallbackOrder,
    played: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchPoints: 0,
    gamesWon: 0,
    gamesLost: 0,
    gameDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
  };
}

function registeredAtToMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return 0;
}

function isFinishedMatch(match: PoolStandingsMatch): boolean {
  return (
    (match.status === 'completed' || match.status === 'walkover') &&
    typeof match.winnerId === 'string' &&
    match.winnerId.length > 0
  );
}

export function comparePoolStandingsEntries(a: PoolStandingsEntry, b: PoolStandingsEntry): number {
  if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
  if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
  if (b.gameDifference !== a.gameDifference) return b.gameDifference - a.gameDifference;
  if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
  if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
  if (a.fallbackOrder !== undefined && b.fallbackOrder !== undefined) {
    return a.fallbackOrder - b.fallbackOrder;
  }
  return a.participantName.localeCompare(b.participantName);
}

export function sortRegistrationsForPoolStandings<T extends { id: string; registeredAt?: unknown }>(
  registrations: T[],
): T[] {
  return registrations
    .map((registration, index) => ({ registration, index }))
    .sort((a, b) => {
      const byRegisteredAt = registeredAtToMillis(b.registration.registeredAt) - registeredAtToMillis(a.registration.registeredAt);
      if (byRegisteredAt !== 0) return byRegisteredAt;
      return a.index - b.index;
    })
    .map(({ registration }) => registration);
}

export function toPoolStandingsParticipants<T extends { id: string; registeredAt?: unknown }>(
  registrations: T[],
  resolveName: (registration: T) => string,
): PoolStandingsParticipant[] {
  return sortRegistrationsForPoolStandings(registrations).map((registration, index) => ({
    registrationId: registration.id,
    participantName: resolveName(registration),
    fallbackOrder: index,
  }));
}

export function buildPoolStandingsEntries(
  participants: PoolStandingsParticipant[],
  matches: PoolStandingsMatch[],
): PoolStandingsEntry[] {
  const standingsMap = new Map<string, PoolStandingsEntry>();

  for (const participant of participants) {
    standingsMap.set(participant.registrationId, createEmptyEntry(participant));
  }

  for (const match of matches) {
    if (!isFinishedMatch(match)) continue;

    const participant1Id = match.participant1Id;
    const participant2Id = match.participant2Id;
    const winnerId = match.winnerId;

    const p1 = participant1Id ? standingsMap.get(participant1Id) : undefined;
    const p2 = participant2Id ? standingsMap.get(participant2Id) : undefined;

    if (p1 && p2) {
      p1.played += 1;
      p2.played += 1;

      let p1Points = 0;
      let p2Points = 0;
      let p1Games = 0;
      let p2Games = 0;

      if (match.status !== 'walkover') {
        for (const score of match.scores ?? []) {
          p1Points += score.score1;
          p2Points += score.score2;

          if (score.score1 > score.score2) {
            p1Games += 1;
          } else if (score.score2 > score.score1) {
            p2Games += 1;
          }
        }
      }

      p1.gamesWon += p1Games;
      p1.gamesLost += p2Games;
      p2.gamesWon += p2Games;
      p2.gamesLost += p1Games;
      p1.gameDifference = p1.gamesWon - p1.gamesLost;
      p2.gameDifference = p2.gamesWon - p2.gamesLost;

      p1.pointsFor += p1Points;
      p1.pointsAgainst += p2Points;
      p2.pointsFor += p2Points;
      p2.pointsAgainst += p1Points;

      if (winnerId === participant1Id) {
        p1.matchesWon += 1;
        p1.matchPoints += 2;
        p2.matchesLost += 1;
        p2.matchPoints += 1;
      } else if (winnerId === participant2Id) {
        p2.matchesWon += 1;
        p2.matchPoints += 2;
        p1.matchesLost += 1;
        p1.matchPoints += 1;
      }

      p1.pointDifference = p1.pointsFor - p1.pointsAgainst;
      p2.pointDifference = p2.pointsFor - p2.pointsAgainst;
      continue;
    }

    if (match.status === 'walkover' && winnerId) {
      const winner = standingsMap.get(winnerId);
      if (winner) {
        winner.played += 1;
        winner.matchesWon += 1;
        winner.matchPoints += 2;
      }
    }
  }

  return Array.from(standingsMap.values()).sort(comparePoolStandingsEntries);
}
