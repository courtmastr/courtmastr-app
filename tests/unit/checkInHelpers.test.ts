import { describe, it, expect } from 'vitest';
import { computeCheckIn } from '../../functions/src/checkInHelpers';

describe('computeCheckIn', () => {
  describe('singles registration', () => {
    it('checks in the player and marks allPresent when the single required participant arrives', () => {
      const result = computeCheckIn({
        participantIds: ['playerA'],
        requiredParticipantIds: ['playerA'],
        currentPresence: {},
        hasCheckedInAt: false,
      });

      expect(result.nextPresence).toEqual({ playerA: true });
      expect(result.allPresent).toBe(true);
      expect(result.nextStatus).toBe('checked_in');
      expect(result.setCheckedInAt).toBe(true);
    });

    it('does not overwrite checkedInAt when it is already set', () => {
      const result = computeCheckIn({
        participantIds: ['playerA'],
        requiredParticipantIds: ['playerA'],
        currentPresence: {},
        hasCheckedInAt: true,
      });

      expect(result.allPresent).toBe(true);
      expect(result.nextStatus).toBe('checked_in');
      expect(result.setCheckedInAt).toBe(false);
    });
  });

  describe('doubles registration — player by player', () => {
    it('partner A checks in: presence updated but team stays approved', () => {
      const result = computeCheckIn({
        participantIds: ['playerA'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence: {},
        hasCheckedInAt: false,
      });

      expect(result.nextPresence).toEqual({ playerA: true });
      expect(result.allPresent).toBe(false);
      expect(result.nextStatus).toBe('approved');
      expect(result.setCheckedInAt).toBe(false);
    });

    it('partner B checks in after A: team becomes checked_in', () => {
      const result = computeCheckIn({
        participantIds: ['playerB'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence: { playerA: true }, // A already checked in
        hasCheckedInAt: false,
      });

      expect(result.nextPresence).toEqual({ playerA: true, playerB: true });
      expect(result.allPresent).toBe(true);
      expect(result.nextStatus).toBe('checked_in');
      expect(result.setCheckedInAt).toBe(true);
    });

    it('checking in both partners at once marks the team as checked_in', () => {
      const result = computeCheckIn({
        participantIds: ['playerA', 'playerB'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence: {},
        hasCheckedInAt: false,
      });

      expect(result.nextPresence).toEqual({ playerA: true, playerB: true });
      expect(result.allPresent).toBe(true);
      expect(result.nextStatus).toBe('checked_in');
      expect(result.setCheckedInAt).toBe(true);
    });

    it('preserves existing presence when a new partner checks in', () => {
      const result = computeCheckIn({
        participantIds: ['playerB'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence: { playerA: true, someOtherKey: true },
        hasCheckedInAt: false,
      });

      expect(result.nextPresence).toEqual({ playerA: true, playerB: true, someOtherKey: true });
    });

    it('partner A re-checks in after undo does not mark team as checked_in', () => {
      // After undo, presence is {} and a single partner checks in again
      const result = computeCheckIn({
        participantIds: ['playerA'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence: {},
        hasCheckedInAt: false,
      });

      expect(result.allPresent).toBe(false);
      expect(result.nextStatus).toBe('approved');
    });
  });

  describe('edge cases', () => {
    it('returns approved and allPresent=false when requiredParticipantIds is empty', () => {
      const result = computeCheckIn({
        participantIds: ['playerA'],
        requiredParticipantIds: [],
        currentPresence: {},
        hasCheckedInAt: false,
      });

      // requiredParticipantIds.length === 0 → allPresent forced false
      expect(result.allPresent).toBe(false);
      expect(result.nextStatus).toBe('approved');
    });

    it('does not mutate the currentPresence object passed in', () => {
      const currentPresence = { playerA: true };
      computeCheckIn({
        participantIds: ['playerB'],
        requiredParticipantIds: ['playerA', 'playerB'],
        currentPresence,
        hasCheckedInAt: false,
      });

      expect(currentPresence).toEqual({ playerA: true }); // unchanged
    });
  });
});
