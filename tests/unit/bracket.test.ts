import { describe, it, expect } from 'vitest';

// Bracket generation logic tests
describe('Bracket Generation', () => {
  describe('Single Elimination', () => {
    function calculateBracketSize(numParticipants: number): number {
      return Math.pow(2, Math.ceil(Math.log2(numParticipants)));
    }

    function calculateNumRounds(bracketSize: number): number {
      return Math.log2(bracketSize);
    }

    function calculateNumByes(bracketSize: number, numParticipants: number): number {
      return bracketSize - numParticipants;
    }

    function calculateByePositions(bracketSize: number, numByes: number): number[] {
      const positions: number[] = [];
      if (numByes === 0) return positions;

      const step = bracketSize / numByes;
      for (let i = 0; i < numByes; i++) {
        positions.push(Math.floor(i * step) + 1);
      }
      return positions;
    }

    it('should calculate bracket size as next power of 2', () => {
      expect(calculateBracketSize(5)).toBe(8);
      expect(calculateBracketSize(8)).toBe(8);
      expect(calculateBracketSize(9)).toBe(16);
      expect(calculateBracketSize(16)).toBe(16);
      expect(calculateBracketSize(17)).toBe(32);
    });

    it('should calculate correct number of rounds', () => {
      expect(calculateNumRounds(4)).toBe(2);
      expect(calculateNumRounds(8)).toBe(3);
      expect(calculateNumRounds(16)).toBe(4);
      expect(calculateNumRounds(32)).toBe(5);
    });

    it('should calculate correct number of byes', () => {
      expect(calculateNumByes(8, 8)).toBe(0);
      expect(calculateNumByes(8, 7)).toBe(1);
      expect(calculateNumByes(8, 5)).toBe(3);
      expect(calculateNumByes(16, 12)).toBe(4);
    });

    it('should distribute byes evenly', () => {
      const positions = calculateByePositions(8, 3);
      expect(positions.length).toBe(3);
      // Byes should be spread across the bracket
      expect(positions[0]).toBeLessThan(positions[1]);
      expect(positions[1]).toBeLessThan(positions[2]);
    });

    it('should return empty array when no byes needed', () => {
      const positions = calculateByePositions(8, 0);
      expect(positions).toEqual([]);
    });
  });

  describe('Match Count Calculations', () => {
    function calculateTotalMatches(numParticipants: number, format: 'single' | 'double'): number {
      if (format === 'single') {
        // In single elimination, total matches = participants - 1
        return numParticipants - 1;
      } else {
        // In double elimination, total matches = 2 * (participants - 1) + 1 (for potential reset)
        return 2 * (numParticipants - 1) + 1;
      }
    }

    it('should calculate single elimination matches correctly', () => {
      expect(calculateTotalMatches(8, 'single')).toBe(7);
      expect(calculateTotalMatches(16, 'single')).toBe(15);
      expect(calculateTotalMatches(32, 'single')).toBe(31);
    });

    it('should calculate double elimination matches correctly', () => {
      expect(calculateTotalMatches(8, 'double')).toBe(15);
      expect(calculateTotalMatches(16, 'double')).toBe(31);
    });
  });

  describe('Match Progression', () => {
    interface Match {
      id: string;
      round: number;
      matchNumber: number;
      participant1Id?: string;
      participant2Id?: string;
      winnerId?: string;
      nextMatchId?: string;
      nextMatchSlot?: 'participant1' | 'participant2';
    }

    function advanceWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
      const match = matches.find(m => m.id === matchId);
      if (!match) return matches;

      // Update winner
      match.winnerId = winnerId;

      // Advance to next match
      if (match.nextMatchId && match.nextMatchSlot) {
        const nextMatch = matches.find(m => m.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 'participant1') {
            nextMatch.participant1Id = winnerId;
          } else {
            nextMatch.participant2Id = winnerId;
          }
        }
      }

      return matches;
    }

    it('should advance winner to next match correctly', () => {
      const matches: Match[] = [
        { id: 'm1', round: 1, matchNumber: 1, participant1Id: 'p1', participant2Id: 'p2', nextMatchId: 'm3', nextMatchSlot: 'participant1' },
        { id: 'm2', round: 1, matchNumber: 2, participant1Id: 'p3', participant2Id: 'p4', nextMatchId: 'm3', nextMatchSlot: 'participant2' },
        { id: 'm3', round: 2, matchNumber: 1 },
      ];

      const updatedMatches = advanceWinner(matches, 'm1', 'p1');
      const finalMatch = updatedMatches.find(m => m.id === 'm3');

      expect(finalMatch?.participant1Id).toBe('p1');
    });

    it('should fill correct slot in next match', () => {
      const matches: Match[] = [
        { id: 'm1', round: 1, matchNumber: 1, participant1Id: 'p1', participant2Id: 'p2', nextMatchId: 'm3', nextMatchSlot: 'participant1' },
        { id: 'm2', round: 1, matchNumber: 2, participant1Id: 'p3', participant2Id: 'p4', nextMatchId: 'm3', nextMatchSlot: 'participant2' },
        { id: 'm3', round: 2, matchNumber: 1 },
      ];

      let updatedMatches = advanceWinner(matches, 'm1', 'p2');
      updatedMatches = advanceWinner(updatedMatches, 'm2', 'p3');

      const finalMatch = updatedMatches.find(m => m.id === 'm3');
      expect(finalMatch?.participant1Id).toBe('p2');
      expect(finalMatch?.participant2Id).toBe('p3');
    });
  });

  describe('Seeding', () => {
    interface Registration {
      id: string;
      seed?: number;
    }

    function sortBySeed(registrations: Registration[]): Registration[] {
      const seeded = registrations.filter(r => r.seed !== undefined).sort((a, b) => (a.seed || 0) - (b.seed || 0));
      const unseeded = registrations.filter(r => r.seed === undefined);
      return [...seeded, ...unseeded];
    }

    it('should sort seeded players first', () => {
      const registrations: Registration[] = [
        { id: 'r1' },
        { id: 'r2', seed: 2 },
        { id: 'r3', seed: 1 },
        { id: 'r4' },
      ];

      const sorted = sortBySeed(registrations);

      expect(sorted[0].id).toBe('r3'); // seed 1
      expect(sorted[1].id).toBe('r2'); // seed 2
      // Unseeded players follow
      expect(sorted[2].seed).toBeUndefined();
      expect(sorted[3].seed).toBeUndefined();
    });

    it('should handle all seeded players', () => {
      const registrations: Registration[] = [
        { id: 'r1', seed: 3 },
        { id: 'r2', seed: 1 },
        { id: 'r3', seed: 2 },
      ];

      const sorted = sortBySeed(registrations);

      expect(sorted[0].seed).toBe(1);
      expect(sorted[1].seed).toBe(2);
      expect(sorted[2].seed).toBe(3);
    });

    it('should handle no seeded players', () => {
      const registrations: Registration[] = [
        { id: 'r1' },
        { id: 'r2' },
        { id: 'r3' },
      ];

      const sorted = sortBySeed(registrations);
      expect(sorted.length).toBe(3);
      expect(sorted.every(r => r.seed === undefined)).toBe(true);
    });
  });
});
