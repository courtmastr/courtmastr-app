import { describe, it, expect } from 'vitest';
import { BADMINTON_CONFIG } from '../../src/types';

// Badminton scoring logic tests
describe('Badminton Scoring Rules', () => {
  const config = BADMINTON_CONFIG;

  describe('Game Completion', () => {
    function checkGameComplete(score1: number, score2: number): { isComplete: boolean; winnerId?: number } {
      const { pointsToWin, mustWinBy, maxPoints } = config;

      // Check for max points (30)
      if (score1 === maxPoints) {
        return { isComplete: true, winnerId: 1 };
      }
      if (score2 === maxPoints) {
        return { isComplete: true, winnerId: 2 };
      }

      // Check for win by 2 after reaching 21
      if (score1 >= pointsToWin && score1 - score2 >= mustWinBy) {
        return { isComplete: true, winnerId: 1 };
      }
      if (score2 >= pointsToWin && score2 - score1 >= mustWinBy) {
        return { isComplete: true, winnerId: 2 };
      }

      return { isComplete: false };
    }

    it('should not complete game when score is below 21', () => {
      const result = checkGameComplete(15, 12);
      expect(result.isComplete).toBe(false);
    });

    it('should complete game at 21-0', () => {
      const result = checkGameComplete(21, 0);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should complete game at 21-19 (win by 2)', () => {
      const result = checkGameComplete(21, 19);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should not complete game at 21-20 (need win by 2)', () => {
      const result = checkGameComplete(21, 20);
      expect(result.isComplete).toBe(false);
    });

    it('should complete game at 22-20 (win by 2 in extended play)', () => {
      const result = checkGameComplete(22, 20);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should not complete game at 29-28', () => {
      const result = checkGameComplete(29, 28);
      expect(result.isComplete).toBe(false);
    });

    it('should complete game at 30-29 (max points)', () => {
      const result = checkGameComplete(30, 29);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should complete game at 29-30 (max points, player 2 wins)', () => {
      const result = checkGameComplete(29, 30);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(2);
    });

    it('should handle player 2 winning normally', () => {
      const result = checkGameComplete(15, 21);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(2);
    });
  });

  describe('Match Completion', () => {
    interface GameScore {
      score1: number;
      score2: number;
      winnerId?: number;
      isComplete: boolean;
    }

    function checkMatchComplete(games: GameScore[]): { isComplete: boolean; winnerId?: number } {
      const gamesNeeded = Math.ceil(config.gamesPerMatch / 2); // 2 for best of 3
      let p1Wins = 0;
      let p2Wins = 0;

      for (const game of games) {
        if (game.isComplete) {
          if (game.winnerId === 1) p1Wins++;
          else if (game.winnerId === 2) p2Wins++;
        }
      }

      if (p1Wins >= gamesNeeded) {
        return { isComplete: true, winnerId: 1 };
      }
      if (p2Wins >= gamesNeeded) {
        return { isComplete: true, winnerId: 2 };
      }

      return { isComplete: false };
    }

    it('should not complete match with 1-0 games', () => {
      const games: GameScore[] = [
        { score1: 21, score2: 15, winnerId: 1, isComplete: true },
      ];
      const result = checkMatchComplete(games);
      expect(result.isComplete).toBe(false);
    });

    it('should complete match at 2-0 games', () => {
      const games: GameScore[] = [
        { score1: 21, score2: 15, winnerId: 1, isComplete: true },
        { score1: 21, score2: 18, winnerId: 1, isComplete: true },
      ];
      const result = checkMatchComplete(games);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should complete match at 2-1 games', () => {
      const games: GameScore[] = [
        { score1: 21, score2: 15, winnerId: 1, isComplete: true },
        { score1: 18, score2: 21, winnerId: 2, isComplete: true },
        { score1: 21, score2: 19, winnerId: 1, isComplete: true },
      ];
      const result = checkMatchComplete(games);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it('should not complete match at 1-1 games', () => {
      const games: GameScore[] = [
        { score1: 21, score2: 15, winnerId: 1, isComplete: true },
        { score1: 18, score2: 21, winnerId: 2, isComplete: true },
      ];
      const result = checkMatchComplete(games);
      expect(result.isComplete).toBe(false);
    });

    it('should handle player 2 winning the match', () => {
      const games: GameScore[] = [
        { score1: 15, score2: 21, winnerId: 2, isComplete: true },
        { score1: 19, score2: 21, winnerId: 2, isComplete: true },
      ];
      const result = checkMatchComplete(games);
      expect(result.isComplete).toBe(true);
      expect(result.winnerId).toBe(2);
    });
  });
});

describe('Badminton Configuration', () => {
  it('should have correct default values', () => {
    expect(BADMINTON_CONFIG.gamesPerMatch).toBe(3);
    expect(BADMINTON_CONFIG.pointsToWin).toBe(21);
    expect(BADMINTON_CONFIG.mustWinBy).toBe(2);
    expect(BADMINTON_CONFIG.maxPoints).toBe(30);
  });
});
