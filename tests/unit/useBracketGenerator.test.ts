import { describe, it, expect } from 'vitest';

describe('calculatePoolGroupCount', () => {
  function calculatePoolGroupCount(
    participantCount: number,
    teamsPerPool?: number
  ): number {
    const size =
      teamsPerPool && teamsPerPool >= 2 ? Math.floor(teamsPerPool) : 4;
    return Math.max(1, Math.ceil(participantCount / size));
  }

  describe('Test Case 1: Core Fix (38 players, teamsPerPool=3)', () => {
    it('should return 13 pools for 38 players with teamsPerPool=3', () => {
      const result = calculatePoolGroupCount(38, 3);
      expect(result).toBe(13);
    });

    it('should distribute 38 players into 13 pools (12x3 + 1x2)', () => {
      const groupCount = calculatePoolGroupCount(38, 3);
      expect(groupCount).toBe(13);
      const playersPerGroup = Math.floor(38 / groupCount);
      const groupsWithExtra = 38 % groupCount;
      expect(playersPerGroup).toBe(2);
      expect(groupsWithExtra).toBe(12);
    });
  });

  describe('Test Case 2: Edge Case (9 players, teamsPerPool=3)', () => {
    it('should return 3 pools for 9 players with teamsPerPool=3', () => {
      const result = calculatePoolGroupCount(9, 3);
      expect(result).toBe(3);
    });

    it('should have no bye pool when players divide evenly', () => {
      const groupCount = calculatePoolGroupCount(9, 3);
      const playersPerGroup = Math.floor(9 / groupCount);
      const groupsWithExtra = 9 % groupCount;
      expect(groupCount).toBe(3);
      expect(playersPerGroup).toBe(3);
      expect(groupsWithExtra).toBe(0);
    });
  });

  describe('Test Case 3: Edge Case (10 players, teamsPerPool=3)', () => {
    it('should return 4 pools for 10 players with teamsPerPool=3', () => {
      const result = calculatePoolGroupCount(10, 3);
      expect(result).toBe(4);
    });

    it('should ensure no pool has more than 3 players', () => {
      const groupCount = calculatePoolGroupCount(10, 3);
      const playersPerGroup = Math.floor(10 / groupCount);
      const groupsWithExtra = 10 % groupCount;
      expect(groupCount).toBe(4);
      expect(groupsWithExtra).toBe(2);
      expect(playersPerGroup).toBe(2);
    });
  });

  describe('Test Case 4: Regression (12 players, teamsPerPool=4)', () => {
    it('should return 3 pools for 12 players with teamsPerPool=4', () => {
      const result = calculatePoolGroupCount(12, 4);
      expect(result).toBe(3);
    });

    it('should have all pools with exactly 4 players', () => {
      const groupCount = calculatePoolGroupCount(12, 4);
      const playersPerGroup = Math.floor(12 / groupCount);
      const groupsWithExtra = 12 % groupCount;
      expect(groupCount).toBe(3);
      expect(playersPerGroup).toBe(4);
      expect(groupsWithExtra).toBe(0);
    });
  });

  describe('Additional edge cases', () => {
    it('should handle minimum of 1 pool', () => {
      expect(calculatePoolGroupCount(1, 4)).toBe(1);
      expect(calculatePoolGroupCount(0, 4)).toBe(1);
    });

    it('should default to 4 teams per pool when not specified', () => {
      expect(calculatePoolGroupCount(8)).toBe(2);
      expect(calculatePoolGroupCount(9)).toBe(3);
    });

    it('should handle large numbers', () => {
      expect(calculatePoolGroupCount(100, 4)).toBe(25);
      expect(calculatePoolGroupCount(101, 4)).toBe(26);
    });

    it('should floor the teamsPerPool value', () => {
      expect(calculatePoolGroupCount(10, 3.9)).toBe(4);
    });
  });
});
